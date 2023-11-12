import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';

const CMD_FLAG_SAMPLE = 'sample';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_SAMPLE, ''],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'script-template';
const SUBSCRIBER_NAME = 'script-template';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('SCRIPT TEMPLATE');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const sample = cmdArgs[CMD_FLAG_SAMPLE].valueOf() as string;

  terminalWriter.writeLine(`Sample : ${sample}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_SAMPLE)) {
    return ['specific', 'options', 'for', 'flag'];
  }
  return CMD_FLAGS;
}
