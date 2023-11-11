import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  ENTRY_DIVIDER,
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

const MODULE_NAME = 'hosts-drain';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Drain Hosts of all Funds');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  let targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;

  terminalWriter.writeLine(`Target Hosts : ${targetHosts}`);
  terminalWriter.writeLine(`Include Home : ${includeHome}`);
  terminalWriter.writeLine(SECTION_DIVIDER);
  terminalWriter.writeLine('See script logs for on-going attack details.');
  netscript.tail();

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  if (targetHosts.length < 1) {
    scriptLogWriter.writeLine(
      'No target hosts provided.  Scanning wide network for targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true, false, true, true);
  }

  scriptLogWriter.writeLine(
    `Draining all funds from ${targetHosts.length} target hosts...`
  );
  let hackedFundsTotal = 0;
  for (const hostname of targetHosts) {
    scriptLogWriter.writeLine(`${hostname}`);
    const hostDetails = analyzeHost(netscript, hostname);
    scriptLogWriter.writeLine(
      `  Draining all funds (~${convertMillisecToTime(
        hostDetails.hackTime
      )})...`
    );
    const hackResults = await hackHost(netscript, hostDetails, 1, includeHome);
    hackedFundsTotal += hackResults.hackedFunds;
    scriptLogWriter.writeLine(
      `  Drained $${netscript.formatNumber(hackResults.hackedFunds)}`
    );
    scriptLogWriter.writeLine(ENTRY_DIVIDER);
  }

  const successMsg = `Successfully drained all host funds for total $${netscript.formatNumber(
    hackedFundsTotal
  )}`;
  terminalWriter.writeLine(successMsg);
  scriptLogWriter.writeLine(successMsg);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }
  return CMD_FLAGS;
}
