import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {analyzeHost} from '/scripts/workflows/recon';
import { CmdArgsSchema } from '/scripts/common/shared';
import { parseCmdFlags } from '/scripts/workflows/cmd-args';

const CMD_ARG_TARGETS_CSV = 'targetsCsv';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [[CMD_ARG_TARGETS_CSV, '']];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'analyze-hosts', LoggerMode.TERMINAL);
  logWriter.writeLine('Analyze Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_ARGS_SCHEMA);
  const targetHostsCsv = cmdArgs.targetsCsv.valueOf() as string;
  const targetHosts = targetHostsCsv.split(',');

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
