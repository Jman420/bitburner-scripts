import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {analyzeHost} from '/scripts/workflows/recon';
import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_TARGETS, []]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'analyze-hosts', LoggerMode.TERMINAL);
  logWriter.writeLine('Analyze Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  for (const hostname of targetHosts) {
    const hostDetails = analyzeHost(netscript, hostname);

    logWriter.writeLine(`Hostname : ${hostDetails.hostname}`);
    logWriter.writeLine(`Security Level : ${hostDetails.securityLevel}`);
    logWriter.writeLine(`Min Security Level : ${hostDetails.minSecurityLevel}`);
    logWriter.writeLine(`Available Funds : ${hostDetails.availableFunds}`);
    logWriter.writeLine(`Maximum Funds : ${hostDetails.maxFunds}`);
    logWriter.writeLine(`Ports Required : ${hostDetails.requiredPorts}`);
    logWriter.writeLine(`Weaken Time: ${hostDetails.weakenTime}`);
    logWriter.writeLine(`Grow Rate : ${hostDetails.growRate}`);
    logWriter.writeLine(`Grow Time : ${hostDetails.growTime}`);
    logWriter.writeLine(`Hack Level : ${hostDetails.hackLevel}`);
    logWriter.writeLine(`Hack Time : ${hostDetails.hackTime}`);
    logWriter.writeLine(ENTRY_DIVIDER);
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
