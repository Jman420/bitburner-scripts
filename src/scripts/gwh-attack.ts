import {NS} from '@ns';

import {Logger, getLogger} from '/scripts/logging/loggerManager';
import {
  ENTRY_DIVIDER,
  SECTION_DIVIDER,
  logServerDetails,
} from '/scripts/logging/logOutput';

import {scanLocalNetwork, analyzeServer} from '/scripts/workflows/recon';
import {growWeakenHack} from '/scripts/workflows/attack';
import {infiniteLoop} from '/scripts/workflows/shared';

const CMD_ARG_TARGETS = 'targets';
const CMD_ARG_SECURITY_LIMIT_MULTIPLIER = 'securityLimitMultiplier';
const CMD_ARGS_FUNDS_LIMIT_MULTIPLIER = 'fundsLimitMultiplier';
const CMD_ARGS_SCHEMA: [string, string | number | boolean | string[]][] = [
  [CMD_ARG_TARGETS, []],
  [CMD_ARG_SECURITY_LIMIT_MULTIPLIER, 1],
  [CMD_ARGS_FUNDS_LIMIT_MULTIPLIER, 1]
];

async function attackNetwork(netscript: NS, logWriter: Logger, targetHosts: string[] = [], securityLimitMultiplier = 1, fundsLimitMultiplier = 1) {
  if (!targetHosts) {
    targetHosts = scanLocalNetwork(netscript, false, true);
  }
  logWriter.writeLine(`Found ${targetHosts.length} available hosts`);

  for (const hostname of targetHosts) {
    logWriter.writeLine(ENTRY_DIVIDER);
    logWriter.writeLine('Getting Player Level...');
    const playerLevel = netscript.getHackingLevel();

    logWriter.writeLine(`Analyzing server : ${hostname}`);
    const serverDetails = analyzeServer(netscript, hostname);
    logWriter.writeLine(`  Player Level : ${playerLevel}`);
    logServerDetails(logWriter, serverDetails);

    logWriter.writeLine('  Grow-Weaken-Hack Attacking Server...');
    await growWeakenHack(netscript, serverDetails, securityLimitMultiplier, fundsLimitMultiplier);
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'gwh-attack');
  logWriter.writeLine('Local Network Grow-Weaken-Hack Attack');
  logWriter.writeLine(`Local Host : ${netscript.getHostname()}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = netscript.flags(CMD_ARGS_SCHEMA);
  const targetHosts = cmdArgs.targets.valueOf() as string[];
  const securityLimitMultiplier = cmdArgs.securityLimitMultiplier.valueOf() as number;
  const fundsLimitMultiplier = cmdArgs.fundsLimitMultiplier.valueOf() as number;

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Security Limit Multiplier : ${securityLimitMultiplier}`);
  logWriter.writeLine(`Funds Limit Multiplier : ${fundsLimitMultiplier}`);
  logWriter.writeLine(SECTION_DIVIDER);

  await infiniteLoop(netscript, attackNetwork, netscript, logWriter, targetHosts, securityLimitMultiplier, fundsLimitMultiplier);
}
