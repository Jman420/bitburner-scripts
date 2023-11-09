import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  SECTION_DIVIDER,
  convertMillisecToTime,
} from '/scripts/logging/logOutput';

import {
  CMD_FLAG_INCLUDE_HOME,
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {analyzeHost, scanWideNetwork} from '/scripts/workflows/recon';
import {hackHost} from '/scripts/workflows/orchestration';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_TARGETS, []],
  [CMD_FLAG_INCLUDE_HOME, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'hosts-drain', LoggerMode.TERMINAL);
  logWriter.writeLine('Drain Hosts of all Funds');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  let targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Include Home : ${includeHome}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Scanning wide network for targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true, false, true, true);
  }

  logWriter.writeLine(
    `Draining all funds from ${targetHosts.length} target hosts...`
  );
  let hackedFundsTotal = 0;
  for (const hostname of targetHosts) {
    logWriter.writeLine(`${hostname}`);
    const hostDetails = analyzeHost(netscript, hostname);
    logWriter.writeLine(
      `  Draining all funds (~${convertMillisecToTime(
        hostDetails.hackTime
      )})...`
    );
    const hackResults = await hackHost(netscript, hostDetails, 1, includeHome);
    hackedFundsTotal += hackResults.hackedFunds;
    logWriter.writeLine(
      `  Drained $${netscript.formatNumber(hackResults.hackedFunds)}`
    );
  }
  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine(
    `Successfully drained all host funds for total $${netscript.formatNumber(
      hackedFundsTotal
    )}`
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }
  return CMD_FLAGS;
}
