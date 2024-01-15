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
  MaterialName,
  UnlockName,
  UpgradeName,
} from '/scripts/data/corporation-enums';
import {
  BENCHMARK_OFFICE,
  PRICING_SETUP_SCRIPT,
  SMART_SUPPLY_SCRIPT,
  TEA_PARTY_SCRIPT,
} from '/scripts/workflows/corporation-shared';
import {
  assignEmployees,
  buyAdvert,
  buyCorpUpgrade,
  manageIndustryMaterials,
  createDivision,
  createFraudDivisions,
  setupExport,
  upgradeOffices,
  improveWarehouse,
  waitForResearch,
} from '/scripts/workflows/corporation-actions';
import {
  generateOfficeAssignments,
  getMaxAffordableAdvertLevel,
} from '/scripts/workflows/corporation-formulas';
import {
  getOptimalDivisionFactoryAndStorage,
  getOptimalIndustryMaterials,
} from '/scripts/workflows/corporation-optimization';
import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';
import {REQUIRED_FUNDS as ROUND_3_REQUIRED_FUNDS} from '/scripts/corp-round3';

const CMD_FLAG_FRAUD_DIVISIONS = 'fraudDivisions';
const CMD_FLAG_AGRICULTURE_RESEARCH = 'agricultureResearch';
const CMD_FLAG_CHEMICAL_RESEARCH = 'chemicalResearch';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_FRAUD_DIVISIONS, 17],
  [CMD_FLAG_AGRICULTURE_RESEARCH, 245],
  [CMD_FLAG_CHEMICAL_RESEARCH, 150],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-round2';
const SUBSCRIBER_NAME = 'corp-round2';

const TAIL_X_POS = 615;
const TAIL_Y_POS = 979;
const TAIL_WIDTH = 790;
const TAIL_HEIGHT = 365;

export const REQUIRED_FUNDS = 431e9; // $431b
const AGRICULTURE_OFFICE_SIZE = 6;
const AGRICULTURE_MATERIAL_RATIO = 0.8;
const CHEMICAL_MATERIAL_RATIO = 0.95;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporation Automation - Investor Round 2');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const fraudDivisions = cmdArgs[CMD_FLAG_FRAUD_DIVISIONS].valueOf() as number;
  const agricultureResearch = cmdArgs[
    CMD_FLAG_AGRICULTURE_RESEARCH
  ].valueOf() as number;
  const chemicalResearch = cmdArgs[
    CMD_FLAG_CHEMICAL_RESEARCH
  ].valueOf() as number;

  terminalWriter.writeLine(`Dummy Division Count : ${fraudDivisions}`);
  terminalWriter.writeLine(`Agriculture Research : ${agricultureResearch}`);
  terminalWriter.writeLine(`Chemical Research : ${chemicalResearch}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  const corpApi = nsLocator.corporation;
  const investmentOfferInfo = await corpApi['getInvestmentOffer']();
  if (investmentOfferInfo.round !== 2) {
    terminalWriter.writeLine(
      `Invalid investor round : ${investmentOfferInfo.round}.  Script meant for investor round 2.`
    );
    return;
  }

  let corpInfo = await corpApi['getCorporation']();
  if (corpInfo.funds < REQUIRED_FUNDS) {
    terminalWriter.writeLine(
      `Insufficient funds for round 2.  Required funds : ${netscript.formatNumber(
        REQUIRED_FUNDS
      )}`
    );
    return;
  }

  terminalWriter.writeLine(
    'See script logs for on-going corporation upgrade details.'
  );
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  scriptLogWriter.writeLine('Running required support scripts...');
  runScript(netscript, PRICING_SETUP_SCRIPT);
  runScript(netscript, SMART_SUPPLY_SCRIPT);

  scriptLogWriter.writeLine('Buying Export unlock...');
  await corpApi['purchaseUnlock'](UnlockName.EXPORT);

  scriptLogWriter.writeLine('Running Corporate Tea Party script...');
  runScript(netscript, TEA_PARTY_SCRIPT);

  scriptLogWriter.writeLine(
    `Upgrading Agriculture Division to ${AGRICULTURE_OFFICE_SIZE} employees...`
  );
  await upgradeOffices(
    nsLocator,
    DivisionNames.AGRICULTURE,
    CITY_NAMES,
    AGRICULTURE_OFFICE_SIZE
  );

  scriptLogWriter.writeLine('Assigning all Agriculture employees to RnD...');
  const rndAssignments = new Map<EmployeePosition, number>([
    [EmployeePosition.RESEARCH_DEVELOPMENT, AGRICULTURE_OFFICE_SIZE],
  ]);
  await assignEmployees(
    nsLocator,
    DivisionNames.AGRICULTURE,
    generateOfficeAssignments(rndAssignments)
  );

  scriptLogWriter.writeLine('Creating Chemical Division...');
  await createDivision(
    nsLocator,
    DivisionNames.CHEMICAL,
    IndustryType.CHEMICAL
  );

  scriptLogWriter.writeLine(
    'Setting up output sales & export supply chains...'
  );
  for (const cityName of CITY_NAMES) {
    await setupExport(
      nsLocator,
      DivisionNames.AGRICULTURE,
      cityName,
      DivisionNames.CHEMICAL,
      cityName,
      MaterialName.PLANTS
    );
    await setupExport(
      nsLocator,
      DivisionNames.CHEMICAL,
      cityName,
      DivisionNames.AGRICULTURE,
      cityName,
      MaterialName.CHEMICALS
    );
  }

  scriptLogWriter.writeLine(
    `Creating ${fraudDivisions} fraudulent divisions to boost investment offers...`
  );
  await createFraudDivisions(nsLocator, fraudDivisions);

  scriptLogWriter.writeLine(
    'Calculating optimal storage & factory upgrades...'
  );
  corpInfo = await corpApi['getCorporation']();
  const optimalUpgrades = await getOptimalDivisionFactoryAndStorage(
    nsLocator,
    DivisionNames.AGRICULTURE,
    corpInfo.funds,
    AGRICULTURE_MATERIAL_RATIO
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
    `  Production : ${netscript.formatNumber(optimalUpgrades.production)}`
  );
  scriptLogWriter.writeLine(
    `  Total Cost : $${netscript.formatNumber(optimalUpgrades.cost)}`
  );

  scriptLogWriter.writeLine('Buying optimal storage & factory upgrades...');
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

  scriptLogWriter.writeLine('Upgrading warehouses to optimal level...');
  for (const cityName of CITY_NAMES) {
    await improveWarehouse(
      nsLocator,
      DivisionNames.AGRICULTURE,
      cityName,
      optimalUpgrades.warehouseLevel
    );
  }

  corpInfo = await corpApi['getCorporation']();
  const advertLevel = await corpApi['getHireAdVertCount'](
    DivisionNames.AGRICULTURE
  );
  const maxAdvert = getMaxAffordableAdvertLevel(advertLevel, corpInfo.funds);
  scriptLogWriter.writeLine(
    `Buying Advert level ${maxAdvert} for Agriculture Division...`
  );
  await buyAdvert(nsLocator, DivisionNames.AGRICULTURE, maxAdvert);

  scriptLogWriter.writeLine('Waiting for research points...');
  scriptLogWriter.writeLine(
    `  ${DivisionNames.AGRICULTURE} : ${agricultureResearch}`
  );
  scriptLogWriter.writeLine(
    `  ${DivisionNames.CHEMICAL} : ${chemicalResearch}`
  );
  const researchPromises = new Array<Promise<void>>();
  researchPromises.push(
    waitForResearch(nsPackage, DivisionNames.AGRICULTURE, agricultureResearch)
  );
  researchPromises.push(
    waitForResearch(nsPackage, DivisionNames.CHEMICAL, chemicalResearch)
  );
  await Promise.allSettled(researchPromises);

  scriptLogWriter.writeLine(
    'Assigning Agriculture Division employee positions : 2ops / 1eng / 1bus / 2mgmt'
  );
  const agricultureEmployeeAssignments = new Map<EmployeePosition, number>([
    [EmployeePosition.OPERATIONS, 2],
    [EmployeePosition.ENGINEER, 1],
    [EmployeePosition.BUSINESS, 1],
    [EmployeePosition.MANAGEMENT, 2],
  ]);
  await assignEmployees(
    nsLocator,
    DivisionNames.AGRICULTURE,
    generateOfficeAssignments(agricultureEmployeeAssignments, CITY_NAMES)
  );

  scriptLogWriter.writeLine(
    'Assigning Chemical Division employee positions : 1ops / 1eng / 1bus'
  );
  const chemicalEmployeeAssignments = new Map<EmployeePosition, number>([
    [EmployeePosition.OPERATIONS, 1],
    [EmployeePosition.ENGINEER, 1],
    [EmployeePosition.BUSINESS, 1],
  ]);
  await assignEmployees(
    nsLocator,
    DivisionNames.CHEMICAL,
    generateOfficeAssignments(chemicalEmployeeAssignments, CITY_NAMES)
  );

  scriptLogWriter.writeLine('Calculating optimal industry materials...');
  const agricultureWarehouse = await corpApi['getWarehouse'](
    DivisionNames.AGRICULTURE,
    BENCHMARK_OFFICE
  );
  const chemicalWarehouse = await corpApi['getWarehouse'](
    DivisionNames.CHEMICAL,
    BENCHMARK_OFFICE
  );
  const agricultureIndustryMaterials = await getOptimalIndustryMaterials(
    nsLocator,
    IndustryType.AGRICULTURE,
    agricultureWarehouse.size * AGRICULTURE_MATERIAL_RATIO
  );
  const chemicalIndustryMaterials = await getOptimalIndustryMaterials(
    nsLocator,
    IndustryType.CHEMICAL,
    chemicalWarehouse.size * CHEMICAL_MATERIAL_RATIO
  );

  scriptLogWriter.writeLine('Buying optimal industry materials...');
  const materialsPromises = new Array<Promise<void>>();
  materialsPromises.push(
    ...(await manageIndustryMaterials(
      nsPackage,
      DivisionNames.AGRICULTURE,
      CITY_NAMES,
      agricultureIndustryMaterials
    ))
  );
  materialsPromises.push(
    ...(await manageIndustryMaterials(
      nsPackage,
      DivisionNames.CHEMICAL,
      CITY_NAMES,
      chemicalIndustryMaterials
    ))
  );
  await Promise.allSettled(materialsPromises);

  scriptLogWriter.writeLine('Corporation Round 2 setup complete!');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  scriptLogWriter.writeLine('Wait for an investment offer of at least $27.5t');
  scriptLogWriter.writeLine(
    `The next round requires at least $${netscript.formatNumber(
      ROUND_3_REQUIRED_FUNDS
    )} funds`
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FRAUD_DIVISIONS)) {
    return [10, 15, 17, 20];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_AGRICULTURE_RESEARCH)) {
    return [225, 245, 265, 285];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_CHEMICAL_RESEARCH)) {
    return [125, 150, 175, 200];
  }
  return CMD_FLAGS;
}
