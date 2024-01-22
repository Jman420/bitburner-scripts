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
  takeBestInvestmentOffer,
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
  BENCHMARK_OFFICE,
  CMD_FLAG_AUTO_INVESTMENT,
  PRICING_SETUP_SCRIPT,
  ROUND1_ADVERT_LEVEL,
  SMART_SUPPLY_SCRIPT,
} from '/scripts/workflows/corporation-shared';
import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';
import {REQUIRED_FUNDS as ROUND2_REQUIRED_FUNDS} from '/scripts/corp-round2';
import {killWorkerScripts} from '/scripts/workflows/orchestration';

export const CMD_FLAG_MATERIALS_RATIO = 'materialsRatio';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_MATERIALS_RATIO, 0.87],
  [CMD_FLAG_AUTO_INVESTMENT, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-round1';
const SUBSCRIBER_NAME = 'corp-round1';

const TAIL_X_POS = 615;
const TAIL_Y_POS = 930;
const TAIL_WIDTH = 790;
const TAIL_HEIGHT = 415;

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
  const autoInvestment = cmdArgs[CMD_FLAG_AUTO_INVESTMENT].valueOf() as boolean;

  terminalWriter.writeLine(`Materials Ratio : ${materialsRatio}`);
  terminalWriter.writeLine(`Auto Investment : ${autoInvestment}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
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

  let corpInfo = await corpApi['getCorporation']();
  if (!corpInfo.divisions.includes(DivisionNames.AGRICULTURE)) {
    scriptLogWriter.writeLine('Creating Agriculture Division...');
    await createDivision(
      nsLocator,
      DivisionNames.AGRICULTURE,
      IndustryType.AGRICULTURE
    );

    scriptLogWriter.writeLine(
      'Calculating optimal storage & factory upgrades...'
    );
    corpInfo = await corpApi['getCorporation']();
    const advertLevel = await corpApi['getHireAdVertCount'](
      DivisionNames.AGRICULTURE
    );
    const advertCost = getAdvertCost(advertLevel, ROUND1_ADVERT_LEVEL);
    const upgradesBudget = corpInfo.funds - advertCost;
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
    await buyAdvert(nsLocator, DivisionNames.AGRICULTURE, ROUND1_ADVERT_LEVEL);

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
  }

  scriptLogWriter.writeLine('Waiting for Morale & Energy to max out (100)...');
  await waitForMoraleAndEnergy(nsPackage, DivisionNames.AGRICULTURE);

  scriptLogWriter.writeLine('Buying optimal industry materials...');
  const warehouseInfo = await corpApi['getWarehouse'](
    DivisionNames.AGRICULTURE,
    BENCHMARK_OFFICE
  );
  const optimalIndustryMaterials = await getOptimalIndustryMaterials(
    nsLocator,
    IndustryType.AGRICULTURE,
    warehouseInfo.size * materialsRatio
  );
  const industryMaterialsTasks = await manageIndustryMaterials(
    nsPackage,
    DivisionNames.AGRICULTURE,
    CITY_NAMES,
    optimalIndustryMaterials
  );
  await Promise.allSettled(industryMaterialsTasks);

  scriptLogWriter.writeLine(
    'Assigning employees to positions : 1ops / 1eng / 1bus ...'
  );
  const workerAssigments = new Map<EmployeePosition, number>([
    [EmployeePosition.OPERATIONS, 1],
    [EmployeePosition.ENGINEER, 1],
    [EmployeePosition.BUSINESS, 1],
  ]);
  const officeAssignments = generateOfficeAssignments(workerAssigments);
  await assignEmployees(
    nsLocator,
    DivisionNames.AGRICULTURE,
    officeAssignments
  );

  scriptLogWriter.writeLine('Running required support scripts...');
  await killWorkerScripts(nsPackage);
  runScript(netscript, PRICING_SETUP_SCRIPT);
  runScript(netscript, SMART_SUPPLY_SCRIPT);

  scriptLogWriter.writeLine('Corporation Round 1 setup complete!');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  if (autoInvestment) {
    scriptLogWriter.writeLine(
      'Automatically accepting best investment offer...'
    );
    const investmentInfo = await takeBestInvestmentOffer(nsPackage);
    if (!investmentInfo) {
      scriptLogWriter.writeLine(
        'Failed to accept investement offer!  Make sure to manually accept offer ASAP!'
      );
    } else {
      scriptLogWriter.writeLine(
        `Accepted investment offer for $${netscript.formatNumber(
          investmentInfo.funds
        )}`
      );
    }
  } else {
    scriptLogWriter.writeLine('Wait for an investment offer of at least $490b');
  }
  scriptLogWriter.writeLine(
    `The next round requires at least $${netscript.formatNumber(
      ROUND2_REQUIRED_FUNDS
    )} funds`
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MATERIALS_RATIO)) {
    return [0.8, 0.87, 0.95];
  }
  return CMD_FLAGS;
}
