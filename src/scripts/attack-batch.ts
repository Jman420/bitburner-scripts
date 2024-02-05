import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  SECTION_DIVIDER,
  convertMillisecToTime,
} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {infiniteLoop, initializeScript} from '/scripts/workflows/execution';
import {SCRIPTS_DIR} from '/scripts/common/shared';
import {
  NetscriptPackage,
  getGhostPackage,
} from '/scripts/netscript-services/netscript-ghost';
import {openTail} from '/scripts/workflows/ui';
import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {ExitEvent} from '/scripts/comms/events/exit-event';
import {AttackBatchConfig, getBatchDetails} from '/scripts/workflows/attacks';
import {AttackBatchConfigEvent} from '/scripts/comms/events/attack-batch-config-event';
import {AttackBatchConfigRequest} from '/scripts/comms/requests/attack-batch-config-request';
import {AttackBatchConfigResponse} from '/scripts/comms/responses/attack-batch-config-response';
import {
  analyzeHost,
  getTotalAvailableRam,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {scoreHostForAttack} from '/scripts/workflows/scoring-new';
import {
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  WEAKEN_WORKER_SCRIPT,
  runWorkerScript,
  waitForWorkers,
} from '/scripts/workflows/orchestration';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {CMD_FLAG_DELAY, CMD_FLAG_TARGETS_CSV} from '/scripts/workers/shared';

export const ATTACK_BATCH_SCRIPT = `${SCRIPTS_DIR}/attack-batch.js`;

export const CMD_FLAG_TARGET = 'target';
export const CMD_FLAG_MAX_FUNDS_PERCENT = 'maxFundsPercent';
export const CMD_FLAG_HACK_FUNDS_PERCENT = 'hackFundsPercent';
export const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_TARGET, ''],
  [CMD_FLAG_MAX_FUNDS_PERCENT, 1],
  [CMD_FLAG_HACK_FUNDS_PERCENT, 0.1],
  [CMD_FLAG_INCLUDE_HOME, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'attack-batch';
const SUBSCRIBER_NAME = 'attack-batch';

const TAIL_X_POS = 1015;
const TAIL_Y_POS = 105;
const TAIL_WIDTH = 650;
const TAIL_HEIGHT = 500;

const MAX_BATCH_COUNT = 4e5; // 400k
const DELAY_FOR_TARGET = 5000;
const BATCH_BUFFER_DELAY = 10;

let scriptConfig: AttackBatchConfig;
let workerPids: number[] | undefined;

async function manageAttacks(nsPackage: NetscriptPackage, logWriter: Logger) {
  logWriter.writeLine('Executing attack batch...');
  const netscript = nsPackage.netscript;

  logWriter.writeLine('Finding optimal attack target...');
  const attackHosts = scanWideNetwork(netscript, {
    includeHome: scriptConfig.includeHomeAttacker,
    rootOnly: true,
    requireRam: true,
  });
  const optimalTarget = await getOptimalTarget(nsPackage, attackHosts);

  if (!optimalTarget) {
    logWriter.writeLine(
      'Unable to find optimal attack target.  Waiting for more targets.'
    );
    await netscript.asleep(DELAY_FOR_TARGET);
    return;
  }

  logWriter.writeLine(`Preparing target : ${optimalTarget.hostname}...`);
  const targetDetails = analyzeHost(netscript, optimalTarget.hostname);
  const targetMaxFunds = targetDetails.maxFunds * scriptConfig.maxFundsPercent;
  const scriptArgs = [getCmdFlag(CMD_FLAG_TARGETS_CSV), targetDetails.hostname];
  let needWeakenCycle =
    targetDetails.securityLevel > targetDetails.minSecurityLevel;
  let needGrowCycle = targetDetails.availableFunds < targetMaxFunds;
  while (needWeakenCycle || needGrowCycle) {
    if (needGrowCycle) {
      logWriter.writeLine(
        `  ${targetDetails.hostname} - Grow (~${convertMillisecToTime(
          targetDetails.growTime
        )})`
      );
      const growPids = runWorkerScript(
        netscript,
        GROW_WORKER_SCRIPT,
        WORKERS_PACKAGE,
        true,
        1,
        scriptConfig.includeHomeAttacker,
        ...scriptArgs
      );
      await waitForWorkers(netscript, growPids);
    }
    if (needWeakenCycle) {
      logWriter.writeLine(
        `  ${targetDetails.hostname} - Weaken (~${convertMillisecToTime(
          targetDetails.weakenTime
        )})`
      );
      const weakenPids = runWorkerScript(
        netscript,
        WEAKEN_WORKER_SCRIPT,
        WORKERS_PACKAGE,
        true,
        1,
        scriptConfig.includeHomeAttacker,
        ...scriptArgs
      );
      await waitForWorkers(netscript, weakenPids);
    }

    needWeakenCycle =
      targetDetails.securityLevel > targetDetails.minSecurityLevel;
    needGrowCycle = targetDetails.availableFunds < targetMaxFunds;
  }

  const batchDetails = optimalTarget.batchDetails;
  const ramPerBatch = batchDetails.ramPerBatch;
  let availableRam = getTotalAvailableRam(netscript, attackHosts);
  if (ramPerBatch > availableRam) {
    const missingRam = batchDetails.ramPerBatch - availableRam;
    logWriter.writeLine('Unable to attack optimal target :');
    logWriter.writeLine(`  RAM Per Batch : ${ramPerBatch}`);
    logWriter.writeLine(`  Available RAM : ${availableRam}`);
    logWriter.writeLine(`  Missing RAM : ${missingRam}`);
    logWriter.writeLine('Waiting for more available RAM...');
    await netscript.asleep(DELAY_FOR_TARGET);
    return;
  }

  logWriter.writeLine(
    `Calculating batch delays for target : ${targetDetails.hostname}`
  );
  const weakenGrowBatchDelay = 0;
  const growBatchDelay =
    targetDetails.weakenTime -
    targetDetails.growTime +
    weakenGrowBatchDelay +
    BATCH_BUFFER_DELAY;
  const weakenEndBatchDelay = BATCH_BUFFER_DELAY * 2;
  const hackBatchDelay =
    targetDetails.weakenTime -
    targetDetails.hackTime +
    weakenEndBatchDelay +
    BATCH_BUFFER_DELAY;
  logWriter.writeLine(
    `    Hack delay : ${convertMillisecToTime(hackBatchDelay)}`
  );
  logWriter.writeLine(
    `    Weaken-Grow delay : ${convertMillisecToTime(weakenGrowBatchDelay)}`
  );
  logWriter.writeLine(
    `    Grow delay : ${convertMillisecToTime(growBatchDelay)}`
  );
  logWriter.writeLine(
    `    Weaken-End delay : ${convertMillisecToTime(weakenEndBatchDelay)}`
  );

  logWriter.writeLine(
    `Executing ~${optimalTarget.maxBatchCount} batches against target : ${optimalTarget.hostname}`
  );
  availableRam = getTotalAvailableRam(netscript, attackHosts);
  const workerPids = [];
  while (availableRam >= ramPerBatch) {
    workerPids.push(
      ...runWorkerScript(
        netscript,
        HACK_WORKER_SCRIPT,
        WORKERS_PACKAGE,
        false,
        batchDetails.hackThreads,
        scriptConfig.includeHomeAttacker,
        getCmdFlag(CMD_FLAG_TARGETS_CSV),
        targetDetails.hostname,
        getCmdFlag(CMD_FLAG_DELAY),
        hackBatchDelay
      )
    );
  }
  await waitForWorkers(netscript, workerPids);
}

async function getOptimalTarget(
  nsPackage: NetscriptPackage,
  attackHosts: string[]
) {
  const netscript = nsPackage.netscript;

  const targetHosts = scanWideNetwork(netscript, {
    rootOnly: true,
    requireFunds: true,
  });

  const totalAvailableRam = getTotalAvailableRam(netscript, attackHosts);
  const targetDetails = await Promise.all(
    targetHosts.map(async value => {
      const batchDetails = await getBatchDetails(
        nsPackage,
        value,
        scriptConfig.maxFundsPercent,
        scriptConfig.hackFundsPercent
      );
      const maxBatchCount = Math.min(
        batchDetails.ramPerBatch / totalAvailableRam,
        MAX_BATCH_COUNT
      );
      const targetScore = await scoreHostForAttack(
        nsPackage,
        value,
        scriptConfig.hackFundsPercent,
        maxBatchCount
      );

      return {
        hostname: value,
        batchDetails: batchDetails,
        maxBatchCount: maxBatchCount,
        score: targetScore,
      };
    })
  );
  targetDetails.sort((valueA, valueB) => valueA.score - valueB.score);

  return targetDetails.at(0);
}

function handleUpdateConfigEvent(
  eventData: AttackBatchConfigEvent,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  const newConfig = eventData.config;
  scriptConfig.hackFundsPercent =
    newConfig.hackFundsPercent ?? scriptConfig.hackFundsPercent;
  scriptConfig.maxFundsPercent =
    newConfig.maxFundsPercent ?? scriptConfig.maxFundsPercent;
  scriptConfig.includeHomeAttacker =
    newConfig.includeHomeAttacker ?? scriptConfig.includeHomeAttacker;

  logWriter.writeLine(`  Hack Percent : ${scriptConfig.hackFundsPercent}`);
  logWriter.writeLine(
    `  Funds Limit Percent : ${scriptConfig.maxFundsPercent}`
  );
  logWriter.writeLine(
    `  Include Home Attacker : ${scriptConfig.includeHomeAttacker}`
  );
}

function handleConfigRequest(
  requestData: AttackBatchConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending batch attack config response to ${requestData.sender}`
  );
  sendMessage(new AttackBatchConfigResponse(scriptConfig), requestData.sender);
}

function handleExit(eventData: ExitEvent, netscript: NS) {
  if (workerPids) {
    for (const pid of workerPids) {
      netscript.kill(pid);
    }
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getGhostPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Hack Attack Script - Shotgun Batch');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const maxFundsPercent = cmdArgs[
    CMD_FLAG_MAX_FUNDS_PERCENT
  ].valueOf() as number;
  const hackFundsPercent = cmdArgs[
    CMD_FLAG_HACK_FUNDS_PERCENT
  ].valueOf() as number;
  const includeHomeAttacker = cmdArgs[
    CMD_FLAG_INCLUDE_HOME
  ].valueOf() as boolean;

  terminalWriter.writeLine(`Max Funds Percent : ${maxFundsPercent}`);
  terminalWriter.writeLine(`Hack Funds Percent : ${hackFundsPercent}`);
  terminalWriter.writeLine(`Include Home Attacker : ${includeHomeAttacker}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  scriptConfig = {
    includeHomeAttacker: includeHomeAttacker,
    hackFundsPercent: hackFundsPercent,
    maxFundsPercent: maxFundsPercent,
  };

  terminalWriter.writeLine('See script logs for on-going attack details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(ExitEvent, handleExit, netscript);
  eventListener.addListener(
    AttackBatchConfigEvent,
    handleUpdateConfigEvent,
    scriptLogWriter
  );
  eventListener.addListener(
    AttackBatchConfigRequest,
    handleConfigRequest,
    scriptLogWriter
  );

  await infiniteLoop(
    netscript,
    manageAttacks,
    undefined,
    nsPackage,
    scriptLogWriter
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_HACK_FUNDS_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MAX_FUNDS_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
