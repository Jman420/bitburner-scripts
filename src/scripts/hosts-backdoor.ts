import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {scanWideNetwork} from '/scripts/workflows/recon';
import {installBackdoor} from '/scripts/workflows/escalation';

import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_TARGETS, []]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'hosts-backdoor';
const SUBSCRIBER_NAME = 'hosts-backdoor';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Backdoor All Available Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  let targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all backdoorable hosts...'
    );
    const availableHosts = scanWideNetwork(netscript, false, false);
    const playerLevel = netscript.getHackingLevel();
    targetHosts = availableHosts.filter(
      host =>
        !(netscript.getServer(host).backdoorInstalled ?? true) &&
        netscript.getServerRequiredHackingLevel(host) <= playerLevel
    );
    logWriter.writeLine(`Found ${targetHosts.length} backdoorable hosts...`);
    logWriter.writeLine(SECTION_DIVIDER);
  }

  for (const hostname of targetHosts) {
    logWriter.writeLine(`Installing backdoor on ${hostname}`);
    installBackdoor(netscript, hostname);
  }
  logWriter.writeLine(
    'Successfully installed backdoor on all backdoorable hosts.'
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
