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

import {openTail} from '/scripts/workflows/ui';

import {CITY_NAMES} from '/scripts/common/shared';

import {initializeScript} from '/scripts/workflows/execution';
import {
  purchaseMaterial,
  resetMultiplierMaterialPurchases,
  saleMaterial,
} from '/scripts/workflows/corporation-actions';
import {getOptimalIndustryMaterials} from '/scripts/workflows/corporation-optimization';
import {
  NetscriptPackage,
  getGhostPackage,
} from '/scripts/netscript-services/netscript-ghost';
import {ExitEvent} from '/scripts/comms/events/exit-event';
import {EventListener} from '/scripts/comms/event-comms';

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

async function purchaseMaterials(
  nsPackage: NetscriptPackage,
  logWriter: Logger,
  divisionName: string,
  cityNames: CityName[],
  storageSize: number
) {
  const nsLocator = nsPackage.ghost;
  const netscript = nsPackage.netscript;
  const corpApi = nsLocator.corporation;

  logWriter.writeLine(
    `Determining optimal materials for division ${divisionName}`
  );
  const divisionInfo = await corpApi['getDivision'](divisionName);
  const optimalAmounts = await getOptimalIndustryMaterials(
    nsLocator,
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

  const transactionPromises = [];
  for (const cityName of cityNames) {
    const warehouseInfo = await corpApi['getWarehouse'](divisionName, cityName);
    logWriter.writeLine(
      `City : ${cityName} - Storage : ${netscript.formatNumber(
        warehouseInfo.size
      )}`
    );
    if (warehouseInfo.size >= storageSize) {
      for (const [materialName, materialAmount] of optimalAmounts) {
        const officeMaterialInfo = await corpApi['getMaterial'](
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
            purchaseMaterial(
              nsPackage,
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
            saleMaterial(
              nsPackage,
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

async function handleExit(
  eventData: ExitEvent,
  nsPackage: NetscriptPackage,
  divisionName: string,
  cityNames: CityName[]
) {
  await resetMultiplierMaterialPurchases(nsPackage, divisionName, cityNames);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getGhostPackage(netscript);
  const nsLocator = nsPackage.ghost;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);

  const corpInfo = await nsLocator.corporation['getCorporation']();
  DIVISION_NAMES = corpInfo.divisions.map(value => `'${value}'`);

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

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(
    ExitEvent,
    handleExit,
    nsPackage,
    divisionName,
    cityNames
  );

  const purchasePromises = await purchaseMaterials(
    nsPackage,
    scriptLogWriter,
    divisionName,
    cityNames,
    storageSize
  );
  await Promise.allSettled(purchasePromises);
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
