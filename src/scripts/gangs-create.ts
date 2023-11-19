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

const CMD_FLAG_FACTION_NAME = 'factionName';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_FACTION_NAME, '']];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'gangs-create';
const SUBSCRIBER_NAME = 'gangs-create';

let availableFactions: string[];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  availableFactions = netscript.getPlayer().factions;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Gang Creator');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const factionName = cmdArgs[CMD_FLAG_FACTION_NAME].valueOf() as string;

  terminalWriter.writeLine(`Faction Name : ${factionName}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  const gangCreated = netscript.gang.createGang(factionName);
  terminalWriter.writeLine(
    `Gang with faction ${factionName} creation success : ${gangCreated}`
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FACTION_NAME)) {
    if (!availableFactions || availableFactions.length < 1) {
      return ['Run script to initialize available Factions!'];
    }
    return availableFactions;
  }
  return CMD_FLAGS;
}
