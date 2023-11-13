import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  ENTRY_DIVIDER,
  SECTION_DIVIDER,
  convertMillisecToTime,
} from '/scripts/logging/logOutput';

import {analyzeHost, scanWideNetwork} from '/scripts/workflows/recon';
import {
  WeightScoreValues,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';
import {infiniteLoop, initializeScript} from '/scripts/workflows/execution';
import {growHost, hackHost, weakenHost} from '/scripts/workflows/orchestration';
import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

const CMD_FLAG_CONTINUOUS_ATTACK = 'continuousAttack';
const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAG_OPTIMAL_ONLY = 'optimalOnly';
const CMD_FLAG_HACK_PERCENT = 'hackPercent';
const CMD_FLAG_FUNDS_LIMIT_WEIGHT = 'fundsLimitWeight';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_CONTINUOUS_ATTACK, false],
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_OPTIMAL_ONLY, 0],
  [CMD_FLAG_HACK_PERCENT, 0.75],
  [CMD_FLAG_FUNDS_LIMIT_WEIGHT, 1],
  [CMD_FLAG_TARGETS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'wgwh-manager';
const SUBSCRIBER_NAME = 'wgwh-manager';

async function attackTargets(
  netscript: NS,
  logWriter: Logger,
  targetHosts: string[],
  hackPercent = 0.75,
  optimalOnlyCount = 0,
  includeHomeAttacker = false,
  fundsLimitWeight = 1,
  weightScoreValues: WeightScoreValues = {
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
    expGain: 1,
  }
) {
  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all rooted host targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true, false, true, true);
  }
  logWriter.writeLine('Sorting target hosts by optimality...');
  let targetsAnalysis = targetHosts.map(value => analyzeHost(netscript, value));
  sortOptimalTargetHosts(targetsAnalysis, weightScoreValues);
  logWriter.writeLine(`Sorted ${targetsAnalysis.length} target hosts.`);

  if (optimalOnlyCount > 0) {
    logWriter.writeLine(
      `Isolating top ${optimalOnlyCount} most optimal targets...`
    );
    targetsAnalysis = targetsAnalysis.slice(0, optimalOnlyCount);
  }

  logWriter.writeLine(`Attacking ${targetsAnalysis.length} targets...`);
  for (
    let targetCounter = 0;
    targetCounter < targetsAnalysis.length;
    targetCounter++
  ) {
    let hostDetails = targetsAnalysis[targetCounter];
    hostDetails = analyzeHost(netscript, hostDetails.hostname); // Re-analyze host since Player may have leveled up since previous analysis

    logWriter.writeLine(ENTRY_DIVIDER);
    logWriter.writeLine(`Target Host : ${hostDetails.hostname}`);
    logWriter.writeLine(
      `  Weakening Host for Growth (~${convertMillisecToTime(
        hostDetails.weakenTime
      )})...`
    );
    hostDetails = await weakenHost(netscript, hostDetails, includeHomeAttacker);
    logWriter.writeLine(
      `  Growing Host (~${convertMillisecToTime(hostDetails.growTime)})...`
    );
    hostDetails = await growHost(
      netscript,
      hostDetails,
      includeHomeAttacker,
      fundsLimitWeight
    );
    logWriter.writeLine(
      `  Weakening Host for Hack (~${convertMillisecToTime(
        hostDetails.weakenTime
      )})...`
    );
    hostDetails = await weakenHost(netscript, hostDetails, includeHomeAttacker);
    logWriter.writeLine(
      `  Hacking Host (~${convertMillisecToTime(hostDetails.hackTime)})...`
    );
    const hackResults = await hackHost(
      netscript,
      hostDetails,
      hackPercent,
      includeHomeAttacker
    );
    logWriter.writeLine(
      `  Hacked Funds : $${netscript.formatNumber(
        hackResults.hackedFunds
      )} / $${netscript.formatNumber(hostDetails.maxFunds)}`
    );

    targetsAnalysis[targetCounter] = hackResults.hostDetails;
  }
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Weaken-Grow Weaken-Hack Attack Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const continuousAttack = cmdArgs[
    CMD_FLAG_CONTINUOUS_ATTACK
  ].valueOf() as boolean;
  const includeHomeAttacker = cmdArgs[
    CMD_FLAG_INCLUDE_HOME
  ].valueOf() as boolean;
  const optimalOnlyCount = cmdArgs[CMD_FLAG_OPTIMAL_ONLY].valueOf() as number;
  const hackPercent = cmdArgs[CMD_FLAG_HACK_PERCENT].valueOf() as number;
  const fundsLimitWeight = cmdArgs[
    CMD_FLAG_FUNDS_LIMIT_WEIGHT
  ].valueOf() as number;
  const targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  terminalWriter.writeLine(`Continuous Attack : ${continuousAttack}`);
  terminalWriter.writeLine(`Include Home Attacker : ${includeHomeAttacker}`);
  terminalWriter.writeLine(`Optimal Only : ${optimalOnlyCount}`);
  terminalWriter.writeLine(`Hack Percent : ${hackPercent}`);
  terminalWriter.writeLine(`Funds Limit Weight : ${fundsLimitWeight}`);
  terminalWriter.writeLine(`Target Hosts : ${targetHosts}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going attack details.');
  netscript.tail();

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  if (continuousAttack) {
    await infiniteLoop(
      netscript,
      attackTargets,
      netscript,
      scriptLogWriter,
      targetHosts,
      hackPercent,
      optimalOnlyCount,
      includeHomeAttacker,
      fundsLimitWeight
    );
  } else {
    await attackTargets(
      netscript,
      scriptLogWriter,
      targetHosts,
      hackPercent,
      optimalOnlyCount,
      includeHomeAttacker,
      fundsLimitWeight
    );
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_OPTIMAL_ONLY)) {
    return ['1', '2', '3', '5', '10', '15'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_HACK_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_WEIGHT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
