import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  BOOLEAN_AUTOCOMPLETE,
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {infiniteLoop} from '/scripts/workflows/execution';
import {analyzeHost, scanWideNetwork} from '/scripts/workflows/recon';
import {
  WeightScoreValues,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';

const CMD_FLAG_CONTINUOUS_ATTACK = 'continuousAttack';
const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAG_OPTIMAL_ONLY = 'optimalOnly';
const CMD_FLAG_HACK_PERCENT = 'hackPercent';
const CMD_FLAG_FUNDS_LIMIT_WEIGHT = 'fundsLimitWeight';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_CONTINUOUS_ATTACK, true],
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_OPTIMAL_ONLY, 0],
  [CMD_FLAG_HACK_PERCENT, 0.75],
  [CMD_FLAG_FUNDS_LIMIT_WEIGHT, 1],
  [CMD_FLAG_TARGETS, ''],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

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
    targetHosts = scanWideNetwork(netscript, false, true, false, true);
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
    // Determine Total Ram needed to fully attack the server (add a constant buffer amount to be safe)
    // Determine if Total Ram can be satisfied by accessible servers (max ram) ; if not then skip
    // Determine if Total Ram can be satisifed with available ram on servers ; if not then wait until Total Ram is available
    // Calculate necessary delays for weaken, grow, weaken & hack batches
    // Execute scripts with appropriate delays
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'script-template',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('SCRIPT TEMPLATE');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
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

  logWriter.writeLine(`Continuous Attack : ${continuousAttack}`);
  logWriter.writeLine(`Include Home Attacker : ${includeHomeAttacker}`);
  logWriter.writeLine(`Optimal Only : ${optimalOnlyCount}`);
  logWriter.writeLine(`Hack Percent : ${hackPercent}`);
  logWriter.writeLine(`Funds Limit Weight : ${fundsLimitWeight}`);
  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (continuousAttack) {
    await infiniteLoop(
      netscript,
      attackTargets,
      netscript,
      logWriter,
      targetHosts,
      hackPercent,
      optimalOnlyCount,
      includeHomeAttacker,
      fundsLimitWeight
    );
  } else {
    await attackTargets(
      netscript,
      logWriter,
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
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_CONTINUOUS_ATTACK)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_INCLUDE_HOME)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
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
