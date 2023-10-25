import {NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER, convertMillisecToTime} from '/scripts/logging/logOutput';

import {removeEmptyString} from '/scripts/common/shared';

import {
  WeightScoreValues,
  analyzeHost,
  scanWideNetwork,
  sortOptimalTargetHosts,
} from '/scripts/workflows/recon';
import {infiniteLoop} from '/scripts/workflows/execution';
import {growHost, hackHost, weakenHost} from '/scripts/workflows/orchestration';
import { CMD_ARG_TARGETS_CSV, CmdArgsSchema, parseCmdFlags } from '/scripts/workflows/cmd-args';

const CMD_ARG_HACK_PERCENT = 'hackPercent';
const CMD_ARG_ONLY_OPTIMAL = 'onlyOptimal';
const CMD_ARG_FUNDS_LIMIT_WEIGHT = 'fundsLimitWeight';
const CMD_ARG_CONTINUOUS_ATTACK = 'continuousAttack';
const CMD_ARG_INCLUDE_HOME = 'includeHome';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [
  [CMD_ARG_TARGETS_CSV, ''],
  [CMD_ARG_HACK_PERCENT, 0.75],
  [CMD_ARG_ONLY_OPTIMAL, false],
  [CMD_ARG_FUNDS_LIMIT_WEIGHT, 1],
  [CMD_ARG_CONTINUOUS_ATTACK, true],
  [CMD_ARG_INCLUDE_HOME, false],
];

async function attackTargets(
  netscript: NS,
  logWriter: Logger,
  targetHosts: string[],
  hackPercent = 0.75,
  onlyOptimal = false,
  includeHomeAttacker = false,
  fundsLimitWeight = 1,
  weightScoreValues: WeightScoreValues = {
    hackLevel: 1,
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
  }
) {
  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all rooted host targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true);
  }
  logWriter.writeLine('Filtering target hosts to hackable hosts...');
  targetHosts.filter(
    value =>
      netscript.getServerRequiredHackingLevel(value) <=
        netscript.getHackingLevel() &&
      netscript.getServerMaxMoney(value) > 0 &&
      netscript.getServerGrowth(value) > 0
  );
  logWriter.writeLine('Sorting target hosts by optimality...');
  let targetsAnalysis = targetHosts.map(value => analyzeHost(netscript, value));
  sortOptimalTargetHosts(targetsAnalysis, weightScoreValues);
  logWriter.writeLine(`Sorted ${targetsAnalysis.length} target hosts.`);

  if (onlyOptimal) {
    logWriter.writeLine('Isolating most optimal target host...');
    targetsAnalysis = targetsAnalysis.slice(0, 1);
  }

  logWriter.writeLine(`Attacking ${targetHosts.length} targets...`);
  for (
    let targetCounter = 0;
    targetCounter < targetsAnalysis.length;
    targetCounter++
  ) {
    let hostDetails = targetsAnalysis[targetCounter];

    logWriter.writeLine(ENTRY_DIVIDER);
    logWriter.writeLine(`Target Host : ${hostDetails.hostname}`);
    logWriter.writeLine(
      `  Weakening Host for Growth (~${convertMillisecToTime(hostDetails.weakenTime)} ms)...`
    );
    hostDetails = await weakenHost(netscript, hostDetails, includeHomeAttacker);
    logWriter.writeLine(`  Growing Host (~${convertMillisecToTime(hostDetails.growTime)} ms)...`);
    hostDetails = await growHost(
      netscript,
      hostDetails,
      includeHomeAttacker,
      fundsLimitWeight
    );
    logWriter.writeLine(
      `  Weakening Host for Hack (~${convertMillisecToTime(hostDetails.weakenTime)} ms)...`
    );
    hostDetails = await weakenHost(netscript, hostDetails, includeHomeAttacker);
    logWriter.writeLine(`  Hacking Host (~${convertMillisecToTime(hostDetails.hackTime)} ms)...`);
    const hackResults = await hackHost(
      netscript,
      hostDetails,
      hackPercent,
      includeHomeAttacker
    );
    logWriter.writeLine(`  Hacked Funds : $${hackResults.hackedFunds}`);

    targetsAnalysis[targetCounter] = hackResults.hostDetails;
  }
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'wgwh-manager', LoggerMode.TERMINAL);
  logWriter.writeLine('WeakenGrowWeakenHack Attack Manager');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_ARGS_SCHEMA);
  const targetHostsCsv = cmdArgs.targetsCsv.valueOf() as string;
  const targetHosts = targetHostsCsv.split(',').filter(removeEmptyString);
  const hackPercent = cmdArgs.hackPercent.valueOf() as number;
  const onlyOptimal = cmdArgs.onlyOptimal.valueOf() as boolean;
  const fundsLimitWeight = cmdArgs.fundsLimitWeight.valueOf() as number;
  const continuousAttack = cmdArgs.continuousAttack.valueOf() as boolean;
  const includeHomeAttacker = cmdArgs.includeHome.valueOf() as boolean;

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Hack Percent : ${hackPercent}`);
  logWriter.writeLine(`Only Optimal : ${onlyOptimal}`);
  logWriter.writeLine(`Funds Limit Weight : ${fundsLimitWeight}`);
  logWriter.writeLine(`Continuous Attack : ${continuousAttack}`);
  logWriter.writeLine(`Include Home Attacker : ${includeHomeAttacker}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (continuousAttack) {
    await infiniteLoop(
      netscript,
      attackTargets,
      netscript,
      logWriter,
      targetHosts,
      hackPercent,
      onlyOptimal,
      includeHomeAttacker,
      fundsLimitWeight
    );
  } else {
    await attackTargets(
      netscript,
      logWriter,
      targetHosts,
      hackPercent,
      onlyOptimal,
      includeHomeAttacker,
      fundsLimitWeight
    );
  }
}
