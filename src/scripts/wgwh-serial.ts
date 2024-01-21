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
import {growHost, hackHost, weakenHost} from '/scripts/workflows/orchestration';
import {WgwhAttackConfig} from '/scripts/workflows/attacks';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {WgwhManagerConfigEvent} from '/scripts/comms/events/wgwh-manager-config-event';
import {WgwhConfigRequest} from '/scripts/comms/requests/wgwh-config-request';
import {WgwhConfigResponse} from '/scripts/comms/responses/wgwh-config-response';

import {openTail} from '/scripts/workflows/ui';
import {SCRIPTS_PATH} from '/scripts/common/shared';

export const WGWH_SERIAL_ATTACK_SCRIPT = `${SCRIPTS_PATH}/wgwh-serial.js`;
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

const TAIL_X_POS = 1045;
const TAIL_Y_POS = 154;
const TAIL_WIDTH = 1275;
const TAIL_HEIGHT = 510;

let managerConfig: WgwhAttackConfig;

async function attackTargets(
  netscript: NS,
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
  let targetHosts = [...managerConfig.targetHosts];
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

  if (managerConfig.optimalOnlyCount > 0) {
    logWriter.writeLine(
      `Isolating top ${managerConfig.optimalOnlyCount} most optimal targets...`
    );
    targetsAnalysis = targetsAnalysis.slice(0, managerConfig.optimalOnlyCount);
  }

  logWriter.writeLine(`Attacking ${targetsAnalysis.length} targets...`);
  for (let hostDetails of targetsAnalysis) {
    hostDetails = analyzeHost(netscript, hostDetails.hostname); // Re-analyze host since Player may have leveled up since previous analysis

    logWriter.writeLine(ENTRY_DIVIDER);
    logWriter.writeLine(`Target Host : ${hostDetails.hostname}`);
    logWriter.writeLine(
      `  Weakening Host for Growth (~${convertMillisecToTime(
        hostDetails.weakenTime
      )})...`
    );
    hostDetails = await weakenHost(
      netscript,
      hostDetails,
      true,
      managerConfig.includeHomeAttacker
    );
    logWriter.writeLine(
      `  Growing Host (~${convertMillisecToTime(hostDetails.growTime)})...`
    );
    hostDetails = await growHost(
      netscript,
      hostDetails,
      true,
      managerConfig.includeHomeAttacker,
      managerConfig.targetFundsLimitPercent
    );
    logWriter.writeLine(
      `  Weakening Host for Hack (~${convertMillisecToTime(
        hostDetails.weakenTime
      )})...`
    );
    hostDetails = await weakenHost(
      netscript,
      hostDetails,
      true,
      managerConfig.includeHomeAttacker
    );
    logWriter.writeLine(
      `  Hacking Host (~${convertMillisecToTime(hostDetails.hackTime)})...`
    );
    const hackResults = await hackHost(
      netscript,
      hostDetails,
      false,
      managerConfig.includeHomeAttacker,
      managerConfig.hackFundsPercent
    );
    logWriter.writeLine(
      `  Hacked Funds : $${netscript.formatNumber(
        hackResults.hackedFunds
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
  managerConfig.attackerHosts =
    newConfig.attackerHosts ?? managerConfig.attackerHosts;
  managerConfig.hackFundsPercent =
    newConfig.hackFundsPercent ?? managerConfig.hackFundsPercent;
  managerConfig.includeHomeAttacker =
    newConfig.includeHomeAttacker ?? managerConfig.includeHomeAttacker;
  managerConfig.optimalOnlyCount =
    newConfig.optimalOnlyCount ?? managerConfig.optimalOnlyCount;
  managerConfig.targetFundsLimitPercent =
    newConfig.targetFundsLimitPercent ?? managerConfig.targetFundsLimitPercent;
  managerConfig.targetHosts =
    newConfig.targetHosts ?? managerConfig.targetHosts;

  logWriter.writeLine(`  Optimal Only : ${managerConfig.optimalOnlyCount}`);
  logWriter.writeLine(`  Hack Percent : ${managerConfig.hackFundsPercent}`);
  logWriter.writeLine(
    `  Funds Limit Percent : ${managerConfig.targetFundsLimitPercent}`
  );
  logWriter.writeLine(`  Target Hosts : ${managerConfig.targetHosts}`);
  logWriter.writeLine(
    `  Include Home Attacker : ${managerConfig.includeHomeAttacker}`
  );
  logWriter.writeLine(`  Attacker Hosts : ${managerConfig.attackerHosts}`);
}

function handleConfigRequest(
  requestData: WgwhConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending serial wgwh attack manager config response to ${requestData.sender}`
  );
  sendMessage(new WgwhConfigResponse(managerConfig), requestData.sender);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
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

  managerConfig = {
    includeHomeAttacker: includeHomeAttacker,
    optimalOnlyCount: optimalOnlyCount,
    hackFundsPercent: hackFundsPercent,
    targetFundsLimitPercent: fundsLimitPercent,
    targetHosts: targetHosts,
    attackerHosts: attackerHosts,
  };

  terminalWriter.writeLine('See script logs for on-going attack details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const netscriptEnabledLogging = DEFAULT_NETSCRIPT_ENABLED_LOGGING.filter(
    value => value !== 'exec'
  );
  const scriptLogWriter = getLogger(
    netscript,
    MODULE_NAME,
    LoggerMode.SCRIPT,
    netscriptEnabledLogging
  );

  const eventListener = new EventListener(SUBSCRIBER_NAME);
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

  await infiniteLoop(netscript, attackTargets, netscript, scriptLogWriter);
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
