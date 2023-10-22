import {NS} from '@ns';

import {CmdArgsSchema} from '/scripts/common/shared';

import {getLogger, LoggerMode} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {scanWideNetwork} from '/scripts/workflows/recon';
import {copyFiles, runScript} from '/scripts/workflows/propagation';

import {
  ATTACK_SCRIPT,
  PAYLOAD_PACKAGE,
  CMD_ARG_TARGETS_CSV,
  CMD_ARG_SECURITY_LIMIT_MULTIPLIER,
  CMD_ARGS_FUNDS_LIMIT_MULTIPLIER,
} from '/scripts/gwh-attack';

const CMD_ARG_INCLUDE_HOME = 'includeHome';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [
  [CMD_ARG_INCLUDE_HOME, false],
  [CMD_ARG_TARGETS_CSV, ''],
  [CMD_ARG_SECURITY_LIMIT_MULTIPLIER, 1],
  [CMD_ARGS_FUNDS_LIMIT_MULTIPLIER, 1],
];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'gwh-all-hosts', LoggerMode.TERMINAL);
  logWriter.writeLine('Run GrowWeakenHack Attack on All Rooted Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = netscript.flags(CMD_ARGS_SCHEMA);
  const includeHome = cmdArgs.includeHome.valueOf() as boolean;
  const targetHostsCsv = cmdArgs.targetsCsv.valueOf() as string;
  const targetHosts = targetHostsCsv.split(',');
  const securityLimitMultiplier =
    cmdArgs.securityLimitMultiplier.valueOf() as number;
  const fundsLimitMultiplier = cmdArgs.fundsLimitMultiplier.valueOf() as number;

  logWriter.writeLine(`Include Home : ${includeHome}`);
  logWriter.writeLine(`Attack Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Security Limit Multiplier : ${securityLimitMultiplier}`);
  logWriter.writeLine(`Funds Limit Multiplier : ${fundsLimitMultiplier}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Getting all rooted hosts...');
  const rootedHosts = scanWideNetwork(netscript, includeHome, true);
  logWriter.writeLine(`Found ${rootedHosts.length} rooted hosts.`);
  logWriter.writeLine(ENTRY_DIVIDER);

  for (const hostname of rootedHosts) {
    logWriter.writeLine(`${hostname} :`);
    logWriter.writeLine('  Copying file packages...');
    copyFiles(netscript, PAYLOAD_PACKAGE, hostname);

    logWriter.writeLine(`  Running ${ATTACK_SCRIPT}...`);
    if (
      runScript(
        netscript,
        ATTACK_SCRIPT,
        hostname,
        true,
        CMD_ARG_TARGETS_CSV,
        targetHosts.join(' '),
        CMD_ARG_SECURITY_LIMIT_MULTIPLIER,
        securityLimitMultiplier,
        CMD_ARGS_FUNDS_LIMIT_MULTIPLIER,
        fundsLimitMultiplier
      )
    ) {
      logWriter.writeLine(`  Successfully running ${ATTACK_SCRIPT}.`);
    } else {
      logWriter.writeLine(`  Failed to run ${ATTACK_SCRIPT}.`);
    }
  }
  logWriter.writeLine(SECTION_DIVIDER);
}
