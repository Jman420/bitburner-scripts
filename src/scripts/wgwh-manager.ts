import {NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {CmdArgsSchema, removeEmptyString} from '/scripts/common/shared';

import {
  WeightScoreValues,
  analyzeServer,
  scanWideNetwork,
  sortOptimalTargetHosts,
} from '/scripts/workflows/recon';
import {infiniteLoop} from '/scripts/workflows/execution';

const CMD_ARG_TARGETS_CSV = 'targetsCsv';
const CMD_ARG_ONLY_OPTIMAL = 'onlyOptimal';
const CMD_ARG_SECURITY_LIMIT_MULTIPLIER = 'securityLimitMultiplier';
const CMD_ARG_FUNDS_LIMIT_MULTIPLIER = 'fundsLimitMultiplier';
const CMD_ARG_CONTINUOUS_ATTACK = 'continuousAttack';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [
  [CMD_ARG_TARGETS_CSV, ''],
  [CMD_ARG_ONLY_OPTIMAL, false],
  [CMD_ARG_SECURITY_LIMIT_MULTIPLIER, 1],
  [CMD_ARG_FUNDS_LIMIT_MULTIPLIER, 1],
  [CMD_ARG_CONTINUOUS_ATTACK, true],
];

async function attackTargets(
  netscript: NS,
  logWriter: Logger,
  targetHosts: string[],
  onlyOptimal = false,
  weightScoreValues: WeightScoreValues = {
    hackLevel: 1,
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
  }
) {
  if (!targetHosts) {
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
  let targetsAnalysis = targetHosts.map(value =>
    analyzeServer(netscript, value)
  );
  sortOptimalTargetHosts(targetsAnalysis, weightScoreValues);
  logWriter.writeLine(`Sorted ${targetsAnalysis.length} target hosts.`);

  if (onlyOptimal) {
    logWriter.writeLine('Isolating most optimal target host...');
    targetsAnalysis = targetsAnalysis.slice(0, 1);
  }

  for (const hostDetails of targetsAnalysis) {
    // TODO (JMG) : Orchestrate the Weaken-Grow & Weaken-Hack Attacks
  }
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'wgwh-manager', LoggerMode.TERMINAL);
  logWriter.writeLine('WeakenGrowWeakenHack Attack Manager');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = netscript.flags(CMD_ARGS_SCHEMA);
  const targetHostsCsv = cmdArgs.targetsCsv.valueOf() as string;
  const targetHosts = targetHostsCsv.split(',').filter(removeEmptyString);
  const onlyOptimal = cmdArgs.onlyOptimal.valueOf() as boolean;
  const securityLimitMultiplier =
    cmdArgs.securityLimitMultiplier.valueOf() as number;
  const fundsLimitMultiplier = cmdArgs.fundsLimitMultiplier.valueOf() as number;
  const continuousAttack = cmdArgs.continuousAttack.valueOf() as boolean;

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Only Optimal : ${onlyOptimal}`);
  logWriter.writeLine(`Security Limit Multiplier : ${securityLimitMultiplier}`);
  logWriter.writeLine(`Funds Limit Multiplier : ${fundsLimitMultiplier}`);
  logWriter.writeLine(`Continuous Attack : ${continuousAttack}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (continuousAttack) {
    infiniteLoop(netscript, attackTargets, logWriter, targetHosts, onlyOptimal);
  } else {
    attackTargets(netscript, logWriter, targetHosts, onlyOptimal);
  }
}
