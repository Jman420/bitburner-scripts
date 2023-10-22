import {NS} from '@ns';

import {CmdArgsSchema} from '/scripts/common/shared';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
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
  securityLimitMultiplier = 1,
  fundsLimitMultiplier = 1
) {
  if (!targetHosts) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all hackable targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true);
  }

  logWriter.writeLine('Sorting target hosts by optimality...');
  sortOptimalTargetHosts(netscript, targetHosts);
  logWriter.writeLine(`Sorted ${targetHosts.length} target hosts.`);

  if (onlyOptimal) {
    logWriter.writeLine('Isolating most optimal target host...');
    targetHosts = targetHosts.slice(0, 1);
  }

  for (const hostname of targetHosts) {
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
  const targetHosts = targetHostsCsv.split(',');
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
    infiniteLoop(
      netscript,
      attackTargets,
      logWriter,
      targetHosts,
      onlyOptimal,
      securityLimitMultiplier,
      fundsLimitMultiplier
    );
  } else {
    attackTargets(
      netscript,
      logWriter,
      targetHosts,
      onlyOptimal,
      securityLimitMultiplier,
      fundsLimitMultiplier
    );
  }
}
