import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';

const CMD_FLAG_REPUTATION = 'reputation';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_REPUTATION, 0]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'faction-donation';
const SUBSCRIBER_NAME = 'faction-donation';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Faction Donation Calculator');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const targetReputation = cmdArgs[CMD_FLAG_REPUTATION].valueOf() as number;

  logWriter.writeLine(`Target Reputation : ${targetReputation}`);
  logWriter.writeLine(SECTION_DIVIDER);

  const player = netscript.getPlayer();
  const donationAmount =
    (targetReputation * 10 ** 6) / player.mults.faction_rep;

  logWriter.writeLine(
    `Required donation : $${netscript.formatNumber(
      donationAmount
    )} ? $${donationAmount}`
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_REPUTATION)) {
    return ['10000', '100000', '500000', '100000000'];
  }
  return CMD_FLAGS;
}
