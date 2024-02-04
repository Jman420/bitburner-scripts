import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  ENTRY_DIVIDER,
  SECTION_DIVIDER,
  convertMillisecToTime,
} from '/scripts/logging/logOutput';

import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {
  getRequiredRam,
  infiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {
  analyzeHost,
  filterHostsCanHack,
  getTotalAvailableRam,
  getTotalMaxRam,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {
  WeightScoreValues,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';
import {
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  WEAKEN_WORKER_SCRIPT,
  runWorkerScript,
  waitForScripts,
} from '/scripts/workflows/orchestration';
import {openTail} from '/scripts/workflows/ui';
import {WgwhAttackConfig} from '/scripts/workflows/attacks';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {WgwhManagerConfigEvent} from '/scripts/comms/events/wgwh-manager-config-event';
import {WgwhConfigRequest} from '/scripts/comms/requests/wgwh-config-request';
import {WgwhConfigResponse} from '/scripts/comms/responses/wgwh-config-response';

import {CMD_FLAG_DELAY, CMD_FLAG_TARGETS_CSV} from '/scripts/workers/shared';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';
import {SCRIPTS_DIR} from '/scripts/common/shared';
import {
  growThreadsRequired,
  hackThreadsRequired,
  weakenThreadsRequired,
} from '/scripts/workflows/formulas';
import {ExitEvent} from '/scripts/comms/events/exit-event';

export const WGWH_BATCH_ATTACK_SCRIPT = `${SCRIPTS_DIR}/wgwh-batch.js`;
export const CMD_FLAG_OPTIMAL_ONLY = 'optimalOnly';
export const CMD_FLAG_HACK_PERCENT = 'hackPercent';
export const CMD_FLAG_FUNDS_LIMIT_PERCENT = 'fundsLimitPercent';
export const CMD_FLAG_INCLUDE_HOME = 'includeHome';
export const CMD_FLAG_ATTACKERS = 'attackers';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_OPTIMAL_ONLY, 0],
  [CMD_FLAG_HACK_PERCENT, 0.1],
  [CMD_FLAG_FUNDS_LIMIT_PERCENT, 1],
  [CMD_FLAG_TARGETS, []],
  [CMD_FLAG_ATTACKERS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'wgwh-batch';
const SUBSCRIBER_NAME = 'wgwh-batch';

const TAIL_X_POS = 1015;
const TAIL_Y_POS = 105;
const TAIL_WIDTH = 650;
const TAIL_HEIGHT = 500;

const DEFAULT_SLEEP_FOR_RAM = 500;
const BATCH_BUFFER_DELAY = 100;

let scriptConfig: WgwhAttackConfig;
let workerPids: number[] | undefined;

async function attackTargets(
  nsPackage: NetscriptPackage,
  logWriter: Logger,
  weightScoreValues: WeightScoreValues = {
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
    expGain: 1,
  }
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  let targetHosts = [...scriptConfig.targetHosts];
  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all rooted host targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true, false, true);
    targetHosts = filterHostsCanHack(netscript, targetHosts);
  }
  logWriter.writeLine('Sorting target hosts by optimality...');
  let targetsAnalysis = targetHosts.map(value => analyzeHost(netscript, value));
  sortOptimalTargetHosts(targetsAnalysis, weightScoreValues);
  logWriter.writeLine(`Sorted ${targetsAnalysis.length} target hosts.`);

  if (scriptConfig.optimalOnlyCount > 0) {
    logWriter.writeLine(
      `Isolating top ${scriptConfig.optimalOnlyCount} most optimal targets...`
    );
    targetsAnalysis = targetsAnalysis.slice(0, scriptConfig.optimalOnlyCount);
  }

  logWriter.writeLine(`Attacking ${targetsAnalysis.length} targets...`);
  logWriter.writeLine(SECTION_DIVIDER);
  let longestBatchTime = 0;
  workerPids = [];
  for (const targetDetails of targetsAnalysis) {
    const hostname = targetDetails.hostname;

    logWriter.writeLine(`Target Host : ${hostname}`);
    logWriter.writeLine('  Calculating required threads & RAM for batches...');
    const weakenGrowBatchThreads = await weakenThreadsRequired(
      nsLocator,
      targetDetails.securityLevel - targetDetails.minSecurityLevel
    );
    const weakenGrowBatchRam = getRequiredRam(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      weakenGrowBatchThreads
    );
    logWriter.writeLine(`    Weaken-Grow threads : ${weakenGrowBatchThreads}`);
    logWriter.writeLine(
      `    Weaken-Grow RAM : ${netscript.formatRam(weakenGrowBatchRam)}`
    );

    const targetMaxFunds =
      scriptConfig.targetFundsLimitPercent * targetDetails.maxFunds;
    const growBatchThreads = await growThreadsRequired(
      nsPackage,
      hostname,
      targetMaxFunds
    );
    const growBatchRam = getRequiredRam(
      netscript,
      GROW_WORKER_SCRIPT,
      growBatchThreads
    );
    const growBatchSecurityIncrease = netscript.growthAnalyzeSecurity(
      growBatchThreads,
      hostname
    );
    logWriter.writeLine(`    Grow threads : ${growBatchThreads}`);
    logWriter.writeLine(`    Grow RAM : ${netscript.formatRam(growBatchRam)}`);

    const weakenHackBatchThreads = await weakenThreadsRequired(
      nsLocator,
      growBatchSecurityIncrease
    );
    const weakenHackBatchRam = getRequiredRam(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      weakenHackBatchThreads
    );
    logWriter.writeLine(`    Weaken-Hack threads : ${weakenHackBatchThreads}`);
    logWriter.writeLine(
      `    Weaken-Hack RAM : ${netscript.formatRam(weakenHackBatchRam)}`
    );

    const hackBatchThreads = await hackThreadsRequired(
      nsPackage,
      hostname,
      scriptConfig.hackFundsPercent
    );
    const hackBatchRam = getRequiredRam(
      netscript,
      HACK_WORKER_SCRIPT,
      hackBatchThreads
    );
    logWriter.writeLine(`    Hack threads : ${hackBatchThreads}`);
    logWriter.writeLine(`    Hack RAM : ${netscript.formatRam(hackBatchRam)}`);

    const totalRamRequired =
      weakenGrowBatchRam + growBatchRam + weakenHackBatchRam + hackBatchRam;
    logWriter.writeLine(
      `    Total RAM : ${netscript.formatRam(totalRamRequired)}`
    );

    // Determine if Total Ram can be satisfied by accessible servers (max ram) ; if not then skip
    const attackHosts = scanWideNetwork(
      netscript,
      scriptConfig.includeHomeAttacker,
      true,
      true
    );
    const totalAttackMaxRam = getTotalMaxRam(netscript, attackHosts);
    if (totalAttackMaxRam < totalRamRequired) {
      logWriter.writeLine(
        '  Required RAM not satisfied by accessible servers.  Skipping target!'
      );
      logWriter.writeLine(
        `    Required RAM : ${netscript.formatRam(totalRamRequired)}`
      );
      logWriter.writeLine(
        `    Max accessible server RAM : ${netscript.formatRam(
          totalAttackMaxRam
        )}`
      );
      continue;
    }

    // Determine if Total Ram can be satisifed with available ram on servers ; if not then wait until Total Ram is available
    let totalAvailableRam = getTotalAvailableRam(netscript, attackHosts);
    if (totalAvailableRam < totalRamRequired) {
      logWriter.writeLine('  Waiting for required RAM to become available...');
      logWriter.writeLine(
        `    Required RAM : ${netscript.formatRam(totalRamRequired)}`
      );
      logWriter.writeLine(
        `    Max accessible server RAM : ${netscript.formatRam(
          totalAvailableRam
        )}`
      );
      while (totalAvailableRam < totalRamRequired) {
        await netscript.asleep(DEFAULT_SLEEP_FOR_RAM);
        totalAvailableRam = getTotalAvailableRam(netscript, attackHosts);
      }
    }

    // Calculate necessary delays for weaken, grow, weaken & hack batches
    logWriter.writeLine('  Calculating delays for worker scripts...');
    const weakenGrowBatchDelay = 0;
    const growBatchDelay =
      targetDetails.weakenTime -
      targetDetails.growTime +
      weakenGrowBatchDelay +
      BATCH_BUFFER_DELAY;
    const weakenHackBatchDelay = BATCH_BUFFER_DELAY * 2;
    const hackBatchDelay =
      targetDetails.weakenTime -
      targetDetails.hackTime +
      weakenHackBatchDelay +
      BATCH_BUFFER_DELAY;
    logWriter.writeLine(
      `    Weaken-Grow delay : ${convertMillisecToTime(weakenGrowBatchDelay)}`
    );
    logWriter.writeLine(
      `    Grow delay : ${convertMillisecToTime(growBatchDelay)}`
    );
    logWriter.writeLine(
      `    Weaken-Hack delay : ${convertMillisecToTime(weakenHackBatchDelay)}`
    );
    logWriter.writeLine(
      `    Hack delay : ${convertMillisecToTime(hackBatchDelay)}`
    );

    // Execute scripts with appropriate delays
    logWriter.writeLine('  Executing worker scripts...');
    const weakenGrowBatchPids = runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      weakenGrowBatchThreads,
      scriptConfig.includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      weakenGrowBatchDelay
    );
    const growBatchPids = runWorkerScript(
      netscript,
      GROW_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      growBatchThreads,
      scriptConfig.includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      growBatchDelay
    );
    const weakenHackBatchPids = runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      weakenHackBatchThreads,
      scriptConfig.includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      weakenHackBatchDelay
    );
    const hackBatchPids = runWorkerScript(
      netscript,
      HACK_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      hackBatchThreads,
      scriptConfig.includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      hackBatchDelay
    );
    workerPids.push(...weakenGrowBatchPids);
    workerPids.push(...growBatchPids);
    workerPids.push(...weakenHackBatchPids);
    workerPids.push(...hackBatchPids);

    const batchExecutionTime = hackBatchDelay + targetDetails.hackTime;
    if (longestBatchTime < batchExecutionTime) {
      longestBatchTime = batchExecutionTime;
    }

    logWriter.writeLine(
      `  Estimated batch completion ~${convertMillisecToTime(
        batchExecutionTime
      )}`
    );
    logWriter.writeLine(ENTRY_DIVIDER);
  }

  if (workerPids && workerPids.length > 0) {
    // Wait for all batches to complete before scheduling the next set
    logWriter.writeLine(
      `Longest batch completion ~${convertMillisecToTime(longestBatchTime)}`
    );
    logWriter.writeLine('Waiting for all batches to complete...');
    await waitForScripts(netscript, workerPids);
    workerPids = undefined;
  } else {
    logWriter.writeLine(
      'Failed to run any batches... waiting for more RAM to become available.'
    );
    await netscript.asleep(20000);
  }
}

function handleUpdateConfigEvent(
  eventData: WgwhManagerConfigEvent,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  const newConfig = eventData.config;
  scriptConfig.attackerHosts =
    newConfig.attackerHosts ?? scriptConfig.attackerHosts;
  scriptConfig.hackFundsPercent =
    newConfig.hackFundsPercent ?? scriptConfig.hackFundsPercent;
  scriptConfig.includeHomeAttacker =
    newConfig.includeHomeAttacker ?? scriptConfig.includeHomeAttacker;
  scriptConfig.optimalOnlyCount =
    newConfig.optimalOnlyCount ?? scriptConfig.optimalOnlyCount;
  scriptConfig.targetFundsLimitPercent =
    newConfig.targetFundsLimitPercent ?? scriptConfig.targetFundsLimitPercent;
  scriptConfig.targetHosts = newConfig.targetHosts ?? scriptConfig.targetHosts;

  logWriter.writeLine(`  Optimal Only : ${scriptConfig.optimalOnlyCount}`);
  logWriter.writeLine(`  Hack Percent : ${scriptConfig.hackFundsPercent}`);
  logWriter.writeLine(
    `  Funds Limit Percent : ${scriptConfig.targetFundsLimitPercent}`
  );
  logWriter.writeLine(`  Target Hosts : ${scriptConfig.targetHosts}`);
  logWriter.writeLine(
    `  Include Home Attacker : ${scriptConfig.includeHomeAttacker}`
  );
  logWriter.writeLine(`  Attacker Hosts : ${scriptConfig.attackerHosts}`);
}

function handleConfigRequest(
  requestData: WgwhConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending batch wgwh attack manager config response to ${requestData.sender}`
  );
  sendMessage(new WgwhConfigResponse(scriptConfig), requestData.sender);
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
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Weaken-Grow Weaken-Hack Batch Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const optimalOnlyCount = cmdArgs[CMD_FLAG_OPTIMAL_ONLY].valueOf() as number;
  const hackFundsPercent = cmdArgs[CMD_FLAG_HACK_PERCENT].valueOf() as number;
  const fundsLimitPercent = cmdArgs[
    CMD_FLAG_FUNDS_LIMIT_PERCENT
  ].valueOf() as number;
  const targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];
  const includeHomeAttacker = cmdArgs[
    CMD_FLAG_INCLUDE_HOME
  ].valueOf() as boolean;
  const attackerHosts = cmdArgs[CMD_FLAG_ATTACKERS].valueOf() as string[];

  terminalWriter.writeLine(`Optimal Only Count : ${optimalOnlyCount}`);
  terminalWriter.writeLine(`Hack Funds Percent : ${hackFundsPercent}`);
  terminalWriter.writeLine(`Funds Limit Percent : ${fundsLimitPercent}`);
  terminalWriter.writeLine(`Target Hosts : ${targetHosts}`);
  terminalWriter.writeLine(`Include Home Attacker : ${includeHomeAttacker}`);
  terminalWriter.writeLine(`Attacker Hosts : ${attackerHosts}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  scriptConfig = {
    includeHomeAttacker: includeHomeAttacker,
    optimalOnlyCount: optimalOnlyCount,
    hackFundsPercent: hackFundsPercent,
    targetFundsLimitPercent: fundsLimitPercent,
    targetHosts: targetHosts,
    attackerHosts: attackerHosts,
  };

  terminalWriter.writeLine('See script logs for on-going attack details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(ExitEvent, handleExit, netscript);
  eventListener.addListener(
    WgwhManagerConfigEvent,
    handleUpdateConfigEvent,
    scriptLogWriter
  );
  eventListener.addListener(
    WgwhConfigRequest,
    handleConfigRequest,
    scriptLogWriter
  );

  await infiniteLoop(
    netscript,
    attackTargets,
    undefined,
    nsPackage,
    scriptLogWriter
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_OPTIMAL_ONLY)) {
    return ['1', '2', '3', '5', '10', '15'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_HACK_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
