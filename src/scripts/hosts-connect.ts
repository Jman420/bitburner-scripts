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

import {HOME_SERVER_NAME} from '/scripts/common/shared';
import {findHostPath} from '/scripts/workflows/recon';
import {runTerminalCommand} from '/scripts/workflows/ui';

const CMD_FLAG_TARGET = 'target';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_TARGET, '']];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'hosts-connect';
const SUBSCRIBER_NAME = 'hosts-connect';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Connect to Host');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const targetHost = cmdArgs[CMD_FLAG_TARGET].valueOf() as string;

  logWriter.writeLine(`Target Host : ${targetHost}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine(`Finding path to host named ${targetHost}...`);
  const hostPath = findHostPath(netscript, HOME_SERVER_NAME, targetHost);
  if (hostPath) {
    const connectionString = hostPath.join('; connect ');
    logWriter.writeLine(`Connection string : ${connectionString}`);
    runTerminalCommand(connectionString);
  } else {
    logWriter.writeLine('Unable to connect.  Path to host not found.');
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGET)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
