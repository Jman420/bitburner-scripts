import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';
import {EXPORT_FORMULA} from '/scripts/workflows/corporation';
import {openTail} from '/scripts/workflows/ui';

export const CMD_FLAG_DIVISION_NAME = 'division';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_DIVISION_NAME, '']];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-export';
const SUBSCRIBER_NAME = 'corp-export';

const TAIL_X_POS = 1230;
const TAIL_Y_POS = 120;
const TAIL_WIDTH = 1090;
const TAIL_HEIGHT = 490;

let DIVISION_NAMES: string[];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  DIVISION_NAMES = netscript.corporation
    .getCorporation()
    .divisions.map(value => `'${value}'`);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporate Export Setup');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const divisionName = cmdArgs[CMD_FLAG_DIVISION_NAME].valueOf() as string;

  terminalWriter.writeLine(`Division Name : ${divisionName}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (!divisionName) {
    terminalWriter.writeLine('No division name provided.');
    terminalWriter.writeLine(SECTION_DIVIDER);
    terminalWriter.writeLine('Available divisions : ');
    for (const divisionName of DIVISION_NAMES) {
      terminalWriter.writeLine(`  ${divisionName}`);
    }
    return;
  }

  terminalWriter.writeLine('See script logs for export setup details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const corpApi = netscript.corporation;
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);

  scriptLogWriter.writeLine('Building Import Map...');
  const corpInfo = corpApi.getCorporation();
  const importMap = new Map<string, string[]>();
  for (const importDivisionName of corpInfo.divisions.filter(
    value => value !== divisionName
  )) {
    const importDivisionInfo = corpApi.getDivision(importDivisionName);
    const importIndustryInfo = corpApi.getIndustryData(importDivisionInfo.type);
    for (const [importMaterialName, importAmount] of Object.entries(
      importIndustryInfo.requiredMaterials
    )) {
      if (importAmount > 0) {
        scriptLogWriter.writeLine(
          `  Adding division ${importDivisionName} for material ${importMaterialName}`
        );
        const importDivisions =
          importMap.get(importMaterialName) ?? new Array<string>();
        importDivisions.push(importDivisionName);
        importMap.set(importMaterialName, importDivisions);
      }
    }
  }
  scriptLogWriter.writeLine(ENTRY_DIVIDER);

  scriptLogWriter.writeLine(
    `Setting up exports for division ${divisionName} ...`
  );
  const exportDivisionInfo = corpApi.getDivision(divisionName);
  const exportIndustryInfo = corpApi.getIndustryData(exportDivisionInfo.type);
  for (const cityName of exportDivisionInfo.cities) {
    for (const exportMaterialName of exportIndustryInfo.producedMaterials ??
      []) {
      const importDivisions = importMap.get(exportMaterialName) ?? [];
      for (const importDivisionName of importDivisions) {
        const exportMaterialInfo = corpApi.getMaterial(
          divisionName,
          cityName,
          exportMaterialName
        );
        if (
          exportMaterialInfo.exports.find(
            value =>
              value.division === importDivisionName && value.city === cityName
          )
        ) {
          scriptLogWriter.writeLine(
            `  Removing existing export to division ${importDivisionName} for material ${exportMaterialName}`
          );
          corpApi.cancelExportMaterial(
            divisionName,
            cityName,
            importDivisionName,
            cityName,
            exportMaterialName
          );
        }
        scriptLogWriter.writeLine(
          `  Setting up export to division ${importDivisionName} for material ${exportMaterialName}`
        );
        corpApi.exportMaterial(
          divisionName,
          cityName,
          importDivisionName,
          cityName,
          exportMaterialName,
          EXPORT_FORMULA
        );
      }
    }
  }
  scriptLogWriter.writeLine(ENTRY_DIVIDER);
  scriptLogWriter.writeLine(
    `Export setup complete for division ${divisionName}`
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_DIVISION_NAME)) {
    if (!DIVISION_NAMES || DIVISION_NAMES.length < 1) {
      return ['Run script to initialize Division Names!'];
    }

    return DIVISION_NAMES;
  }
  return CMD_FLAGS;
}
