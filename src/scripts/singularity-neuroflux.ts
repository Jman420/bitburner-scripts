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
import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';
import {NEUROFLUX_AUGMENTATION_NAME} from '/scripts/workflows/singularity';

const CMD_FLAG_FACTION = 'faction';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_FACTION, '']];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'singularity-neuroflux';
const SUBSCRIBER_NAME = 'singularity-neuroflux';

let FACTION_NAMES: string[];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;
  const singularityApi = nsLocator.singularity;

  FACTION_NAMES = netscript.getPlayer().factions;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Singularity NeuroFlux Governor Mass Purchase');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const factionName = cmdArgs[CMD_FLAG_FACTION].valueOf() as string;

  terminalWriter.writeLine(`Faction Name : ${factionName}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (!factionName) {
    terminalWriter.writeLine('No faction name provided.');
    terminalWriter.writeLine(SECTION_DIVIDER);
    terminalWriter.writeLine('Available factions :');
    for (const factionName of FACTION_NAMES) {
      terminalWriter.writeLine(`  ${factionName}`);
    }
    return;
  }

  let levelCounter: number;
  for (
    levelCounter = 0;
    await singularityApi['purchaseAugmentation'](
      factionName,
      NEUROFLUX_AUGMENTATION_NAME
    );
    levelCounter++
  );
  terminalWriter.writeLine(
    `Purchased ${levelCounter} level of NeuroFlux Governor.`
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FACTION)) {
    return FACTION_NAMES.map(value => `'${value}'`);
  }
  return CMD_FLAGS;
}
