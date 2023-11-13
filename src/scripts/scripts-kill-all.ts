import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CMD_FLAG_INCLUDE_HOME,
  CmdArgsSchema,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';

import {scanWideNetwork} from '/scripts/workflows/recon';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_INCLUDE_HOME, false]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'scripts-kill-all';
const SUBSCRIBER_NAME = 'scripts-kill-all';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
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

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  return CMD_FLAGS;
}
