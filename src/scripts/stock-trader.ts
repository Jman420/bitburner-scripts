import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

const CMD_FLAG_FUNDS_LIMIT = 'fundsLimit';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_FUNDS_LIMIT, 0.75]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'stock-gh-manager',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Stock Market Grow-Hack Manager');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const fundsLimitPercent = cmdArgs[CMD_FLAG_FUNDS_LIMIT].valueOf() as number;

  logWriter.writeLine(
    `Funds Limit Percent : ${netscript.formatPercent(fundsLimitPercent)}`
  );
  logWriter.writeLine(SECTION_DIVIDER);

  if (!netscript.stock.hasWSEAccount() || !netscript.stock.hasTIXAPIAccess()) {
    logWriter.writeLine(
      'Script needs World Stock Exchange account and API access to trade stocks!'
    );
    return;
  }
  
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
