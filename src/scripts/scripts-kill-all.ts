import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {scanWideNetwork} from '/scripts/workflows/recon';

import {
  BOOLEAN_AUTOCOMPLETE,
  CMD_FLAG_INCLUDE_HOME,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_INCLUDE_HOME, true]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'scripts-kill-all',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Kill All Scripts on All Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;

  logWriter.writeLine(`Include Home : ${includeHome}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Scanning wide network for all hosts...');
  const availableHosts = scanWideNetwork(netscript, includeHome);
  logWriter.writeLine(`Found ${availableHosts.length} available hosts`);

  for (const hostname of availableHosts) {
    logWriter.writeLine(`Killing all scripts on host : ${hostname}`);
    netscript.killall(hostname);
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_INCLUDE_HOME)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
