import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {scanWideNetwork} from '/scripts/workflows/recon';
import {SCRIPTS_PATH} from '/scripts/common/shared';

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

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_INCLUDE_HOME, false]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'scripts-remove-all',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Remove All Scripts on All Hosts');
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
    logWriter.writeLine(`Removing all scripts on host : ${hostname}`);
    const scriptPaths = netscript.ls(hostname, `${SCRIPTS_PATH}/`);
    logWriter.writeLine(
      `  Found ${scriptPaths.length} script files for removal...`
    );
    for (const scriptFilePath of scriptPaths) {
      if (!netscript.rm(scriptFilePath, hostname)) {
        logWriter.writeLine(`  Failed to remove script ${scriptFilePath}`);
      }
    }
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_INCLUDE_HOME)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
