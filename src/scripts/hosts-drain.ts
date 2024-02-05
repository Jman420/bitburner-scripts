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

import {initializeScript} from '/scripts/workflows/execution';

import {
  analyzeHost,
  filterHostsCanHack,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {hackHost} from '/scripts/workflows/orchestration';
import {DEFAULT_NETSCRIPT_ENABLED_LOGGING} from '/scripts/logging/scriptLogger';
import {openTail} from '/scripts/workflows/ui';
import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_TARGETS, []],
  [CMD_FLAG_INCLUDE_HOME, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'hosts-drain';
const SUBSCRIBER_NAME = 'hosts-drain';

const TAIL_X_POS = 1045;
const TAIL_Y_POS = 154;
const TAIL_WIDTH = 1275;
const TAIL_HEIGHT = 510;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const netscriptEnabledLogging = DEFAULT_NETSCRIPT_ENABLED_LOGGING.filter(
    value => value !== 'exec'
  );
  const scriptLogWriter = getLogger(
    netscript,
    MODULE_NAME,
    LoggerMode.SCRIPT,
    netscriptEnabledLogging
  );
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
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  if (targetHosts.length < 1) {
    scriptLogWriter.writeLine(
      'No target hosts provided.  Scanning wide network for targets...'
    );
    targetHosts = scanWideNetwork(netscript, {
      rootOnly: true,
      requireFunds: true,
    });
    targetHosts = filterHostsCanHack(netscript, targetHosts);
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
    const hackResults = await hackHost(
      nsPackage,
      hostDetails,
      true,
      includeHome,
      1
    );
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
