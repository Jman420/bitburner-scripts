import {AutocompleteData, NS} from '@ns';

import {getLogger, LoggerMode} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {scanWideNetwork} from '/scripts/workflows/recon';
import {copyFiles} from '/scripts/workflows/propagation';
import {runScript} from '/scripts/workflows/execution';

import {
  ATTACK_SCRIPT,
  PAYLOAD_PACKAGE,
  CMD_FLAG_SECURITY_LIMIT_MULTIPLIER,
  CMD_FLAG_FUNDS_LIMIT_MULTIPLIER,
} from '/scripts/gwh-attack';

import {
  BOOLEAN_AUTOCOMPLETE,
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getSchemaFlags,
  PERCENT_AUTOCOMPLETE,
  parseCmdFlags,
  getLastCmdFlag,
} from '/scripts/workflows/cmd-args';

const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_SECURITY_LIMIT_MULTIPLIER, 1],
  [CMD_FLAG_FUNDS_LIMIT_MULTIPLIER, 1],
  [CMD_FLAG_TARGETS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'gwh-all-hosts', LoggerMode.TERMINAL);
  logWriter.writeLine('Run GrowWeakenHack Attack on All Rooted Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;
  const securityLimitMultiplier = cmdArgs[
    CMD_FLAG_SECURITY_LIMIT_MULTIPLIER
  ].valueOf() as number;
  const fundsLimitMultiplier = cmdArgs[
    CMD_FLAG_FUNDS_LIMIT_MULTIPLIER
  ].valueOf() as number;
  const targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  logWriter.writeLine(`Include Home : ${includeHome}`);
  logWriter.writeLine(`Security Limit Multiplier : ${securityLimitMultiplier}`);
  logWriter.writeLine(`Funds Limit Multiplier : ${fundsLimitMultiplier}`);
  logWriter.writeLine(`Attack Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Getting all rooted hosts...');
  const rootedHosts = scanWideNetwork(netscript, includeHome, true, true);
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
        0,
        true,
        CMD_FLAG_TARGETS,
        targetHosts.join(','),
        CMD_FLAG_SECURITY_LIMIT_MULTIPLIER,
        securityLimitMultiplier,
        CMD_FLAG_FUNDS_LIMIT_MULTIPLIER,
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

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_INCLUDE_HOME)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  if (
    lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_MULTIPLIER) ||
    lastCmdFlag === getCmdFlag(CMD_FLAG_SECURITY_LIMIT_MULTIPLIER)
  ) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
