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

import {openTail} from '/scripts/workflows/ui';
import {initializeScript, runScript} from '/scripts/workflows/execution';

import {CITY_NAMES} from '/scripts/common/shared';

import {
  DivisionNames,
  EmployeePosition,
  IndustryType,
  UpgradeName,
} from '/scripts/data/corporation-enums';
import {
  assignEmployees,
  buyAdvert,
  buyCorpUpgrade,
  manageIndustryMaterials,
  createDivision,
  improveWarehouse,
  waitForMoraleAndEnergy,
} from '/scripts/workflows/corporation-actions';
import {
  generateOfficeAssignments,
  getAdvertCost,
} from '/scripts/workflows/corporation-formulas';
import {
  getOptimalDivisionFactoryAndStorage,
  getOptimalIndustryMaterials,
} from '/scripts/workflows/corporation-optimization';
import {
  PRICING_SETUP_SCRIPT,
  SMART_SUPPLY_SCRIPT,
} from '/scripts/workflows/corporation-shared';
import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';

const CMD_FLAG_MATERIALS_RATIO = 'materialsRatio';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_MATERIALS_RATIO, 0.87]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-round1';
const SUBSCRIBER_NAME = 'corp-round1';

const TAIL_X_POS = 615;
const TAIL_Y_POS = 979;
const TAIL_WIDTH = 790;
const TAIL_HEIGHT = 365;

const TARGET_ADVERT_LEVEL = 2;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporation Automation - Investor Round 1');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const materialsRatio = cmdArgs[CMD_FLAG_MATERIALS_RATIO].valueOf() as number;

  terminalWriter.writeLine(`Materials Ratio : ${materialsRatio}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  const corpApi = nsLocator.corporation;
  const investmentOfferInfo = await corpApi['getInvestmentOffer']();
  if (investmentOfferInfo.round !== 1) {
    terminalWriter.writeLine(
      `Invalid investor round : ${investmentOfferInfo.round}.  Script meant for investor round 1.`
    );
    return;
  }

  terminalWriter.writeLine(
    'See script logs for on-going corporation upgrade details.'
  );
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  scriptLogWriter.writeLine('Creating Agriculture Division...');
  createDivision(
    nsLocator,
    DivisionNames.AGRICULTURE,
    IndustryType.AGRICULTURE
  );

  scriptLogWriter.writeLine(
    'Calculating optimal storage & factory upgrades...'
  );
  const corporationInfo = await corpApi['getCorporation']();
  const advertLevel = await corpApi['getHireAdVertCount'](
    DivisionNames.AGRICULTURE
  );
  const advertCost = getAdvertCost(advertLevel, TARGET_ADVERT_LEVEL);
  const upgradesBudget = corporationInfo.funds - advertCost;
  const optimalUpgrades = await getOptimalDivisionFactoryAndStorage(
    nsLocator,
    DivisionNames.AGRICULTURE,
    upgradesBudget,
    materialsRatio
  );
  if (!optimalUpgrades) {
    scriptLogWriter.writeLine(
      'Round failed!  Unable to find optimal storage & factory upgrades.'
    );
    return;
  }
  scriptLogWriter.writeLine(
    `  Smart Storage Level : ${optimalUpgrades.smartStorageLevel}`
  );
  scriptLogWriter.writeLine(
    `  Warehouse Level : ${optimalUpgrades.warehouseLevel}`
  );
  scriptLogWriter.writeLine(
    `  Warehouse Size : ${optimalUpgrades.warehouseSize}`
  );
  scriptLogWriter.writeLine(
    `  Smart Factories Level : ${optimalUpgrades.smartFactoriesLevel}`
  );
  scriptLogWriter.writeLine(
    `  Production Multiplier : ${netscript.formatNumber(
      optimalUpgrades.production
    )}`
  );
  scriptLogWriter.writeLine(
    `  Total Cost : $${netscript.formatNumber(optimalUpgrades.cost)}`
  );

  scriptLogWriter.writeLine('Buying optimal storage & factory ugrades...');
  await buyCorpUpgrade(
    nsLocator,
    UpgradeName.SMART_STORAGE,
    optimalUpgrades.smartStorageLevel
  );
  await buyCorpUpgrade(
    nsLocator,
    UpgradeName.SMART_FACTORIES,
    optimalUpgrades.smartFactoriesLevel
  );
  await buyAdvert(nsLocator, DivisionNames.AGRICULTURE, TARGET_ADVERT_LEVEL);

  scriptLogWriter.writeLine(
    'Upgrading warehouses to optimal level & setting output sales...'
  );
  for (const cityName of CITY_NAMES) {
    await improveWarehouse(
      nsLocator,
      DivisionNames.AGRICULTURE,
      cityName,
      optimalUpgrades.warehouseLevel
    );
  }

  scriptLogWriter.writeLine('Waiting for Morale & Energy to max out (100)...');
  await waitForMoraleAndEnergy(nsPackage, DivisionNames.AGRICULTURE);

  scriptLogWriter.writeLine('Buying optimal industry materials...');
  const optimalIndustryMaterials = await getOptimalIndustryMaterials(
    nsLocator,
    IndustryType.AGRICULTURE,
    optimalUpgrades.warehouseSize * materialsRatio
  );
  const industryMaterialsTasks = await manageIndustryMaterials(
    nsPackage,
    DivisionNames.AGRICULTURE,
    CITY_NAMES,
    optimalIndustryMaterials
  );
  await Promise.allSettled(industryMaterialsTasks);

  scriptLogWriter.writeLine('Running required support scripts...');
  runScript(netscript, PRICING_SETUP_SCRIPT);
  runScript(netscript, SMART_SUPPLY_SCRIPT);

  scriptLogWriter.writeLine(
    'Assigning employees to positions : 1ops / 1eng / 1bus ...'
  );
  const workerAssigments = new Map<EmployeePosition, number>([
    [EmployeePosition.OPERATIONS, 1],
    [EmployeePosition.ENGINEER, 1],
    [EmployeePosition.BUSINESS, 1],
  ]);
  await assignEmployees(
    nsLocator,
    DivisionNames.AGRICULTURE,
    generateOfficeAssignments(workerAssigments)
  );

  scriptLogWriter.writeLine('Corporation Round 1 setup complete!');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  scriptLogWriter.writeLine('Wait for an investment offer of at least $490b');
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MATERIALS_RATIO)) {
    return [0.8, 0.87, 0.95];
  }
  return CMD_FLAGS;
}
