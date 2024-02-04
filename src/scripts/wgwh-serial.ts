import {AutocompleteData, NS} from '@ns';

import {DEFAULT_NETSCRIPT_ENABLED_LOGGING} from '/scripts/logging/scriptLogger';
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
  analyzeHost,
  filterHostsCanHack,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {
  WeightScoreValues,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';
import {infiniteLoop, initializeScript} from '/scripts/workflows/execution';
import {
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  WEAKEN_WORKER_SCRIPT,
  runWorkerScript,
  waitForScripts,
} from '/scripts/workflows/orchestration';
import {WgwhAttackConfig} from '/scripts/workflows/attacks';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {WgwhManagerConfigEvent} from '/scripts/comms/events/wgwh-manager-config-event';
import {WgwhConfigRequest} from '/scripts/comms/requests/wgwh-config-request';
import {WgwhConfigResponse} from '/scripts/comms/responses/wgwh-config-response';

import {openTail} from '/scripts/workflows/ui';
import {SCRIPTS_DIR} from '/scripts/common/shared';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {CMD_FLAG_TARGETS_CSV} from '/scripts/workers/shared';
import {hackThreadsRequired} from '/scripts/workflows/formulas';
import {ExitEvent} from '/scripts/comms/events/exit-event';
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

export const WGWH_SERIAL_ATTACK_SCRIPT = `${SCRIPTS_DIR}/wgwh-serial.js`;
export const CMD_FLAG_INCLUDE_HOME = 'includeHome';
export const CMD_FLAG_OPTIMAL_ONLY = 'optimalOnly';
export const CMD_FLAG_HACK_PERCENT = 'hackPercent';
export const CMD_FLAG_FUNDS_LIMIT_PERCENT = 'fundsLimitPercent';
export const CMD_FLAG_ATTACKERS = 'attackers';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_OPTIMAL_ONLY, 0],
  [CMD_FLAG_HACK_PERCENT, 0.75],
  [CMD_FLAG_FUNDS_LIMIT_PERCENT, 1],
  [CMD_FLAG_TARGETS, []],
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_ATTACKERS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'wgwh-serial';
const SUBSCRIBER_NAME = 'wgwh-serial';

const TAIL_X_POS = 1015;
const TAIL_Y_POS = 105;
const TAIL_WIDTH = 780;
const TAIL_HEIGHT = 500;

let scriptConfig: WgwhAttackConfig;
let scriptPids: number[] | undefined;

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
  for (let hostDetails of targetsAnalysis) {
    const scriptArgs = [getCmdFlag(CMD_FLAG_TARGETS_CSV), hostDetails.hostname];

    logWriter.writeLine(ENTRY_DIVIDER);
    while (hostDetails.securityLevel > hostDetails.minSecurityLevel) {
      hostDetails = analyzeHost(netscript, hostDetails.hostname); // Re-analyze host since Player may have leveled up since previous analysis
      logWriter.writeLine(
        `${
          hostDetails.hostname
        } - Weakening #1 Host for Growth (~${convertMillisecToTime(
          hostDetails.weakenTime
        )})...`
      );
      scriptPids = runWorkerScript(
        netscript,
        WEAKEN_WORKER_SCRIPT,
        WORKERS_PACKAGE,
        true,
        1,
        scriptConfig.includeHomeAttacker,
        ...scriptArgs
      );
      await waitForScripts(netscript, scriptPids);
      scriptPids = undefined;
    }

    const maxFundsLimit =
      scriptConfig.targetFundsLimitPercent * hostDetails.maxFunds;
    while (hostDetails.availableFunds < maxFundsLimit) {
      hostDetails = analyzeHost(netscript, hostDetails.hostname); // Re-analyze host since Player may have leveled up since previous analysis
      logWriter.writeLine(
        `${hostDetails.hostname} - Growing Host (~${convertMillisecToTime(
          hostDetails.growTime
        )})...`
      );
      scriptPids = runWorkerScript(
        netscript,
        GROW_WORKER_SCRIPT,
        WORKERS_PACKAGE,
        true,
        1,
        scriptConfig.includeHomeAttacker,
        ...scriptArgs
      );
      await waitForScripts(netscript, scriptPids);
      scriptPids = undefined;
    }

    while (hostDetails.securityLevel > hostDetails.minSecurityLevel) {
      hostDetails = analyzeHost(netscript, hostDetails.hostname); // Re-analyze host since Player may have leveled up since previous analysis
      logWriter.writeLine(
        `${
          hostDetails.hostname
        } - Weakening #2 Host for Growth (~${convertMillisecToTime(
          hostDetails.weakenTime
        )})...`
      );
      scriptPids = runWorkerScript(
        netscript,
        WEAKEN_WORKER_SCRIPT,
        WORKERS_PACKAGE,
        true,
        1,
        scriptConfig.includeHomeAttacker,
        ...scriptArgs
      );
      await waitForScripts(netscript, scriptPids);
      scriptPids = undefined;
    }

    hostDetails = analyzeHost(netscript, hostDetails.hostname); // Re-analyze host since Player may have leveled up since previous analysis
    logWriter.writeLine(
      `${hostDetails.hostname} - Hacking Host (~${convertMillisecToTime(
        hostDetails.hackTime
      )})...`
    );
    const prehackFunds = hostDetails.availableFunds;
    const requiredThreads = await hackThreadsRequired(
      nsPackage,
      hostDetails.hostname,
      scriptConfig.hackFundsPercent
    );
    scriptPids = runWorkerScript(
      netscript,
      HACK_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      requiredThreads,
      scriptConfig.includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostDetails.hostname
    );
    await waitForScripts(netscript, scriptPids);
    scriptPids = undefined;

    hostDetails = analyzeHost(netscript, hostDetails.hostname);
    logWriter.writeLine(
      `${hostDetails.hostname} - Hacked Funds : $${netscript.formatNumber(
        prehackFunds - hostDetails.availableFunds
      )} / $${netscript.formatNumber(hostDetails.maxFunds)}`
    );
  }
  logWriter.writeLine(SECTION_DIVIDER);
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
    `Sending serial wgwh attack manager config response to ${requestData.sender}`
  );
  sendMessage(new WgwhConfigResponse(scriptConfig), requestData.sender);
}

function handleExit(eventData: ExitEvent, netscript: NS) {
  if (scriptPids) {
    for (const pid of scriptPids) {
      netscript.kill(pid);
    }
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const netscriptEnabledLogging = DEFAULT_NETSCRIPT_ENABLED_LOGGING.filter(
    value => value !== 'exec'
  );
  const scriptLogWriter = getLogger(
    netscript,
    MODULE_NAME,
    LoggerMode.SCRIPT,
    netscriptEnabledLogging
  );
  terminalWriter.writeLine('Weaken-Grow Weaken-Hack Attack Manager');
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

  terminalWriter.writeLine(`Optimal Only : ${optimalOnlyCount}`);
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
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_ATTACKERS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
