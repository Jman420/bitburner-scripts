import {AutocompleteData, CityName, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';
import {CITY_NAMES} from '/scripts/common/shared';
import {
  buyMaterial,
  getOptimalIndustryMaterials,
  sellMaterial,
} from '/scripts/workflows/corporation';
import {openTail} from '/scripts/workflows/ui';

export const CMD_FLAG_DIVISION_NAME = 'division';
export const CMD_FLAG_CITY_NAMES = 'cities';
export const CMD_FLAG_STORAGE_SIZE = 'storageSize';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_DIVISION_NAME, ''],
  [CMD_FLAG_CITY_NAMES, []],
  [CMD_FLAG_STORAGE_SIZE, 0],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-materials';
const SUBSCRIBER_NAME = 'corp-materials';

const TAIL_X_POS = 1230;
const TAIL_Y_POS = 120;
const TAIL_WIDTH = 1090;
const TAIL_HEIGHT = 490;

let DIVISION_NAMES: string[];

function purchaseMaterials(
  netscript: NS,
  logWriter: Logger,
  divisionName: string,
  cityNames: CityName[],
  storageSize: number
) {
  logWriter.writeLine(
    `Determining optimal materials for division ${divisionName}`
  );
  const divisionInfo = netscript.corporation.getDivision(divisionName);
  const optimalAmounts = getOptimalIndustryMaterials(
    netscript,
    divisionInfo.type,
    storageSize
  );
  for (const [materialName, materialAmount] of optimalAmounts) {
    logWriter.writeLine(`  ${materialName} - ${materialAmount}`);
  }
  logWriter.writeLine(SECTION_DIVIDER);

  if (cityNames.length < 1) {
    logWriter.writeLine(
      'Cities not specified... finding all cities for division...'
    );
    cityNames = divisionInfo.cities;
  }
  logWriter.writeLine(`Included cities : ${cityNames.join(', ')}`);
  logWriter.writeLine(SECTION_DIVIDER);

  const transactionPromises = new Array<Promise<void>>();
  for (const cityName of cityNames) {
    const warehouseInfo = netscript.corporation.getWarehouse(
      divisionName,
      cityName
    );
    logWriter.writeLine(
      `City : ${cityName} - Storage : ${netscript.formatNumber(
        warehouseInfo.size
      )}`
    );
    if (warehouseInfo.size >= storageSize) {
      for (const [materialName, materialAmount] of optimalAmounts) {
        const officeMaterialInfo = netscript.corporation.getMaterial(
          divisionName,
          cityName,
          materialName
        );
        const transactionAmount = materialAmount - officeMaterialInfo.stored;
        if (transactionAmount > 0) {
          logWriter.writeLine(
            `  Purchasing additional material : ${materialName} - ${netscript.formatNumber(
              transactionAmount
            )}`
          );
          transactionPromises.push(
            buyMaterial(
              netscript,
              divisionName,
              cityName,
              materialName,
              transactionAmount
            )
          );
        } else if (transactionAmount < 0) {
          logWriter.writeLine(
            `  Selling excess material : ${materialName} - ${netscript.formatNumber(
              -transactionAmount
            )}`
          );
          transactionPromises.push(
            sellMaterial(
              netscript,
              divisionName,
              cityName,
              materialName,
              -transactionAmount
            )
          );
        } else {
          logWriter.writeLine(
            `  Material already satisfied : ${materialName} - ${netscript.formatNumber(
              materialAmount
            )}`
          );
        }
      }
    } else {
      logWriter.writeLine(`  Storage size under limit : ${storageSize}`);
    }
    logWriter.writeLine(ENTRY_DIVIDER);
  }
  return transactionPromises;
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  DIVISION_NAMES = netscript.corporation
    .getCorporation()
    .divisions.map(value => `'${value}'`);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Purchase Industry Materials');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const divisionName = cmdArgs[CMD_FLAG_DIVISION_NAME].valueOf() as string;
  const cityNames = cmdArgs[CMD_FLAG_CITY_NAMES].valueOf() as CityName[];
  const storageSize = cmdArgs[CMD_FLAG_STORAGE_SIZE].valueOf() as number;

  terminalWriter.writeLine(`Division Name : ${divisionName}`);
  terminalWriter.writeLine(`City Names : ${cityNames.join(', ')}`);
  terminalWriter.writeLine(`Storage Size : ${storageSize}`);
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
  if (storageSize < 1) {
    terminalWriter.writeLine(
      'No storage size provided.  Please provide amount of storage to use for materials.'
    );
    return;
  }

  terminalWriter.writeLine('See script logs for on-going purchase details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const purchasePromises = purchaseMaterials(
    netscript,
    scriptLogWriter,
    divisionName,
    cityNames,
    storageSize
  );
  await Promise.all(purchasePromises);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_DIVISION_NAME)) {
    if (!DIVISION_NAMES || DIVISION_NAMES.length < 1) {
      return ['Run script to initialize Division Names!'];
    }

    return DIVISION_NAMES;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_CITY_NAMES)) {
    return CITY_NAMES.map(value => `'${value}'`);
  }
  return CMD_FLAGS;
}
