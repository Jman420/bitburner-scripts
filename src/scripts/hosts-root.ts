import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {SCRIPTS_DIR} from '/scripts/common/shared';

import {initializeScript} from '/scripts/workflows/execution';

import {scanWideNetwork} from '/scripts/workflows/recon';
import {getRootTools, obtainRoot} from '/scripts/workflows/escalation';

export const ROOT_HOSTS_SCRIPT = `${SCRIPTS_DIR}/hosts-root.js`;
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_TARGETS, []]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'hosts-root';
const SUBSCRIBER_NAME = 'hosts-root';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Root All Available Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  let targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all rootable hosts...'
    );
    const availableHosts = scanWideNetwork(netscript);
    const rootTools = getRootTools(netscript);
    targetHosts = availableHosts.filter(
      host =>
        !netscript.hasRootAccess(host) &&
        netscript.getServerNumPortsRequired(host) <= rootTools.length
    );
    logWriter.writeLine(`Found ${targetHosts.length} rootable hosts...`);
    logWriter.writeLine(SECTION_DIVIDER);
  }

  for (const hostname of targetHosts) {
    logWriter.writeLine(`Obtaining root on ${hostname}`);
    obtainRoot(netscript, hostname);
  }
  logWriter.writeLine('Successfully obtained root on all rootable hosts.');
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
