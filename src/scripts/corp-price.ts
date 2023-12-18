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
import {
  setMaterialMarketTA,
  setProductMarketTA,
} from '/scripts/workflows/corporation';
import {openTail} from '/scripts/workflows/ui';

export const CMD_FLAG_DIVISION_NAME = 'division';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_DIVISION_NAME, '']];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-price';
const SUBSCRIBER_NAME = 'corp-price';

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
  terminalWriter.writeLine('Corporate Pricing Setup');
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

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  scriptLogWriter.writeLine(
    `Setting up pricing for division ${divisionName} ...`
  );
  const divisionInfo = netscript.corporation.getDivision(divisionName);
  const industryInfo = netscript.corporation.getIndustryData(divisionInfo.type);
  for (const cityName of divisionInfo.cities) {
    scriptLogWriter.writeLine(
      `  Setting material prices for city : ${cityName}`
    );
    for (const producedMaterial of industryInfo.producedMaterials ?? []) {
      scriptLogWriter.writeLine(
        `    Setting pricing for material : ${producedMaterial}`
      );
      setMaterialMarketTA(netscript, divisionName, cityName, producedMaterial);
    }
  }
  for (const producedProduct of divisionInfo.products) {
    scriptLogWriter.writeLine(
      `  Setting pricing for product : ${producedProduct}`
    );
    setProductMarketTA(netscript, divisionName, producedProduct);
  }
  scriptLogWriter.writeLine(
    `Pricing setup complete for division ${divisionName}`
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
