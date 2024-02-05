import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';
import {getHostnamesFromSymbol} from '/scripts/workflows/stocks';
import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_TARGETS, []]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'stocks-hosts';
const SUBSCRIBER_NAME = 'stocks-hosts';

let SYMBOLS_LIST: string[];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  SYMBOLS_LIST = await nsLocator.stock['getSymbols']();

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Stock Ticker to Hosts List');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const targetSymbols = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string;

  terminalWriter.writeLine(`Target Symbols : ${targetSymbols}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  for (const symbol of targetSymbols) {
    terminalWriter.writeLine(`Symbol : ${symbol}`);
    const symbolHosts = await getHostnamesFromSymbol(nsPackage, symbol);
    for (const hostname of symbolHosts) {
      terminalWriter.writeLine(`  Host : ${hostname}`);
    }
    terminalWriter.writeLine(ENTRY_DIVIDER);
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    if (!SYMBOLS_LIST || SYMBOLS_LIST.length < 1) {
      return ['Run script to initialize Stock Symbols!'];
    }
    return SYMBOLS_LIST;
  }
  return CMD_FLAGS;
}
