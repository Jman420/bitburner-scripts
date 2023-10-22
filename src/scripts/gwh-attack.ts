import {NS} from '@ns';

import {CmdArgsSchema, SCRIPTS_PATH} from '/scripts/common/shared';

import {Logger, getLogger} from '/scripts/logging/loggerManager';
import {
  ENTRY_DIVIDER,
  SECTION_DIVIDER,
  logServerDetails,
} from '/scripts/logging/logOutput';

import {infiniteLoop} from '/scripts/workflows/execution';
import {scanLocalNetwork, analyzeServer} from '/scripts/workflows/recon';
import {growWeakenHack} from '/scripts/workflows/attack';

import {COMMON_PACKAGE} from '/scripts/common/package';
import {LOGGING_PACKAGE} from '/scripts/logging/package';
import {WORKFLOWS_PACKAGE} from '/scripts/workflows/package';

const ATTACK_SCRIPT = `${SCRIPTS_PATH}/gwh-attack.js`;
const PAYLOAD_PACKAGE = [ATTACK_SCRIPT]
  .concat(COMMON_PACKAGE)
  .concat(LOGGING_PACKAGE)
  .concat(WORKFLOWS_PACKAGE);

const CMD_ARG_TARGETS_CSV = 'targetsCsv';
const CMD_ARG_SECURITY_LIMIT_MULTIPLIER = 'securityLimitMultiplier';
const CMD_ARGS_FUNDS_LIMIT_MULTIPLIER = 'fundsLimitMultiplier';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [
  [CMD_ARG_TARGETS_CSV, ''],
  [CMD_ARG_SECURITY_LIMIT_MULTIPLIER, 1],
  [CMD_ARGS_FUNDS_LIMIT_MULTIPLIER, 1],
];

async function attackNetwork(
  netscript: NS,
  logWriter: Logger,
  targetHosts: string[] = [],
  securityLimitMultiplier = 1,
  fundsLimitMultiplier = 1
) {
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
    await growWeakenHack(
      netscript,
      serverDetails,
      securityLimitMultiplier,
      fundsLimitMultiplier
    );
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
  const targetHostsCsv = cmdArgs.targetsCsv.valueOf() as string;
  const targetHosts = targetHostsCsv.split(',');
  const securityLimitMultiplier =
    cmdArgs.securityLimitMultiplier.valueOf() as number;
  const fundsLimitMultiplier = cmdArgs.fundsLimitMultiplier.valueOf() as number;

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Security Limit Multiplier : ${securityLimitMultiplier}`);
  logWriter.writeLine(`Funds Limit Multiplier : ${fundsLimitMultiplier}`);
  logWriter.writeLine(SECTION_DIVIDER);

  await infiniteLoop(
    netscript,
    attackNetwork,
    netscript,
    logWriter,
    targetHosts,
    securityLimitMultiplier,
    fundsLimitMultiplier
  );
}

export {
  ATTACK_SCRIPT,
  PAYLOAD_PACKAGE,
  CMD_ARG_TARGETS_CSV,
  CMD_ARG_SECURITY_LIMIT_MULTIPLIER,
  CMD_ARGS_FUNDS_LIMIT_MULTIPLIER,
};
