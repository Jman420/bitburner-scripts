import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {openTail} from '/scripts/workflows/ui';
import {initializeScript, runScript} from '/scripts/workflows/execution';

import {CITY_NAMES} from '/scripts/common/shared';

import {
  CorpState,
  DivisionNames,
  IndustryType,
  MaterialName,
  UnlockName,
  UpgradeName,
} from '/scripts/data/corporation-enums';
import {CorpUpgradesData} from '/scripts/data/corporation-upgrades-data';
import {
  CMD_FLAG_AUTO_INVESTMENT,
  CMD_FLAG_BYPASS_FUNDS_REQ,
  PRICING_SETUP_SCRIPT,
  PRODUCT_LIFECYCLE_SCRIPT,
  RAW_MAX_DIVISIONS,
  SMART_SUPPLY_SCRIPT,
  TEA_PARTY_SCRIPT,
} from '/scripts/workflows/corporation-shared';
import {
  DEFAULT_PRODUCT_DESIGN_OFFICE,
  createDivision,
  createFraudDivisions,
  improveProductDivision,
  improveSupportDivision,
  setupExport,
  buyResearchUpgrades,
  buyCorpUpgrade,
  waitForState,
  DEFAULT_PRODUCT_RESEARCH_OFFICES,
  EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE,
  assignEmployees,
  buyIndustryMaterials,
  buyMaxAdvert,
  removeAllExports,
  takeBestInvestmentOffer,
  resetMultiplierMaterialPurchases,
} from '/scripts/workflows/corporation-actions';
import {
  OfficeAssignments,
  calculateAssignmentCounts,
  getAffordableResearchUpgrades,
  getMaxAffordableUpgradeLevel,
} from '/scripts/workflows/corporation-formulas';

import {
  CMD_FLAG_DESIGN_CITY_NAME,
  CMD_FLAG_DIVISION_NAME,
} from '/scripts/corp-product';
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';
import {killWorkerScripts} from '/scripts/workflows/orchestration';
import {EventListener} from '/scripts/comms/event-comms';
import {ExitEvent} from '/scripts/comms/events/exit-event';

export const CMD_FLAG_AGRICULTURE_BUDGET = 'agricultureBudget';
export const CMD_FLAG_CHEMICAL_BUDGET = 'chemicalBudget';
export const CMD_FLAG_MATERIALS = 'materialsBudget';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_AGRICULTURE_BUDGET, 500e9],
  [CMD_FLAG_CHEMICAL_BUDGET, 110e9],
  [CMD_FLAG_MATERIALS, 900e9],
  [CMD_FLAG_AUTO_INVESTMENT, false],
  [CMD_FLAG_BYPASS_FUNDS_REQ, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-round3';
const SUBSCRIBER_NAME = 'corp-round3';

const TAIL_X_POS = 615;
const TAIL_Y_POS = 930;
const TAIL_WIDTH = 790;
const TAIL_HEIGHT = 415;

export const REQUIRED_FUNDS = 27e12; // $27t

const AGRICULTURE_MATERIALS_SPACE_RATIO = 0.1;
const CHEMICAL_MATERIALS_SPACE_RATIO = 0.65;
const TOBACCO_MATERIALS_SPACE_RATIO = 0.95;

async function handleExit(eventData: ExitEvent, nsPackage: NetscriptPackage) {
  const taskPromises = [];
  taskPromises.push(
    resetMultiplierMaterialPurchases(
      nsPackage,
      DivisionNames.AGRICULTURE,
      CITY_NAMES
    )
  );
  taskPromises.push(
    resetMultiplierMaterialPurchases(
      nsPackage,
      DivisionNames.CHEMICAL,
      CITY_NAMES
    )
  );
  taskPromises.push(
    resetMultiplierMaterialPurchases(
      nsPackage,
      DivisionNames.TOBACCO,
      CITY_NAMES
    )
  );
  await Promise.all(taskPromises);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Corporation Automation - Investor Round 3');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const agricultureBudget = cmdArgs[
    CMD_FLAG_AGRICULTURE_BUDGET
  ].valueOf() as number;
  const chemicalBudget = cmdArgs[CMD_FLAG_CHEMICAL_BUDGET].valueOf() as number;
  const materialsBudget = cmdArgs[CMD_FLAG_MATERIALS].valueOf() as number;
  const autoInvestment = cmdArgs[CMD_FLAG_AUTO_INVESTMENT].valueOf() as boolean;
  const bypassFundsReq = cmdArgs[
    CMD_FLAG_BYPASS_FUNDS_REQ
  ].valueOf() as boolean;

  terminalWriter.writeLine(`Agriculture Budget : ${agricultureBudget}`);
  terminalWriter.writeLine(`Chemical Budget : ${chemicalBudget}`);
  terminalWriter.writeLine(`Materials Budget : ${materialsBudget}`);
  terminalWriter.writeLine(`Auto Investment : ${autoInvestment}`);
  terminalWriter.writeLine(`Bypass Funds Requirement : ${bypassFundsReq}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  const corpApi = nsLocator.corporation;
  const investmentOfferInfo = await corpApi['getInvestmentOffer']();
  if (investmentOfferInfo.round !== 3) {
    terminalWriter.writeLine(
      `Invalid investor round : ${investmentOfferInfo.round}.  Script meant for investor round 3.`
    );
    return;
  }

  let corpInfo = await corpApi['getCorporation']();
  const bitnodeMultipliers = await nsLocator['getBitNodeMultipliers']();
  const maxDivisions =
    RAW_MAX_DIVISIONS * bitnodeMultipliers.CorporationDivisions;
  const fraudDivisions = maxDivisions - corpInfo.divisions.length - 1;
  if (fraudDivisions < 0) {
    terminalWriter.writeLine(
      `Too many divisions created.  Please sell ${-fraudDivisions} divisions.`
    );
    return;
  }

  if (!bypassFundsReq && corpInfo.funds < REQUIRED_FUNDS) {
    terminalWriter.writeLine(
      `Insufficient funds for round 3.  Required funds : ${netscript.formatNumber(
        REQUIRED_FUNDS
      )}`
    );
    return;
  }

  terminalWriter.writeLine(
    'See script logs for on-going corporation upgrade details.'
  );
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(ExitEvent, handleExit, nsPackage);

  scriptLogWriter.writeLine('Running required support scripts...');
  await killWorkerScripts(nsPackage);
  runScript(netscript, PRICING_SETUP_SCRIPT);
  runScript(netscript, SMART_SUPPLY_SCRIPT);
  runScript(netscript, TEA_PARTY_SCRIPT);

  scriptLogWriter.writeLine('Buying Market Demand & Competition unlocks...');
  await corpApi['purchaseUnlock'](UnlockName.MARKET_RESEARCH_DEMAND);
  await corpApi['purchaseUnlock'](UnlockName.MARKET_DATA_COMPETITION);

  scriptLogWriter.writeLine(
    `Creating ${fraudDivisions} fraudulent divisions to boost investment offers...`
  );
  await createFraudDivisions(nsLocator, fraudDivisions);

  if (!corpInfo.divisions.includes(DivisionNames.TOBACCO)) {
    scriptLogWriter.writeLine('Creating Tobacco Division...');
    await createDivision(
      nsLocator,
      DivisionNames.TOBACCO,
      IndustryType.TOBACCO
    );

    scriptLogWriter.writeLine('Improving Tobacco Division...');
    const productDivisionBudget =
      corpInfo.funds * 0.99 -
      agricultureBudget -
      chemicalBudget -
      materialsBudget -
      1e9;
    await improveProductDivision(
      nsLocator,
      DivisionNames.TOBACCO,
      productDivisionBudget
    );

    scriptLogWriter.writeLine('Improving Agriculture & Chemical Divisions...');
    await improveSupportDivision(
      nsLocator,
      DivisionNames.AGRICULTURE,
      agricultureBudget
    );
    await improveSupportDivision(
      nsLocator,
      DivisionNames.CHEMICAL,
      chemicalBudget
    );

    scriptLogWriter.writeLine('Buying optimal industry materials...');
    const industryMaterialTasks = [];
    industryMaterialTasks.push(
      buyIndustryMaterials(
        nsPackage,
        DivisionNames.AGRICULTURE,
        AGRICULTURE_MATERIALS_SPACE_RATIO
      )
    );
    industryMaterialTasks.push(
      buyIndustryMaterials(
        nsPackage,
        DivisionNames.CHEMICAL,
        CHEMICAL_MATERIALS_SPACE_RATIO
      )
    );
    industryMaterialTasks.push(
      buyIndustryMaterials(
        nsPackage,
        DivisionNames.TOBACCO,
        TOBACCO_MATERIALS_SPACE_RATIO
      )
    );
    await Promise.allSettled(industryMaterialTasks);
  }

  scriptLogWriter.writeLine('Setting up export supply chains...');
  for (const cityName of CITY_NAMES) {
    await removeAllExports(
      nsLocator,
      DivisionNames.AGRICULTURE,
      cityName,
      MaterialName.PLANTS
    );

    await setupExport(
      nsLocator,
      DivisionNames.AGRICULTURE,
      cityName,
      DivisionNames.TOBACCO,
      cityName,
      MaterialName.PLANTS
    );
    await setupExport(
      nsLocator,
      DivisionNames.AGRICULTURE,
      cityName,
      DivisionNames.CHEMICAL,
      cityName,
      MaterialName.PLANTS
    );
  }

  scriptLogWriter.writeLine('Starting Product Lifecycle Management script...');
  await killWorkerScripts(nsPackage);
  const scriptArgs = [
    getCmdFlag(CMD_FLAG_DIVISION_NAME),
    DivisionNames.TOBACCO,
    getCmdFlag(CMD_FLAG_DESIGN_CITY_NAME),
    DEFAULT_PRODUCT_DESIGN_OFFICE,
  ];
  runScript(netscript, PRODUCT_LIFECYCLE_SCRIPT, {args: scriptArgs});
  await netscript.asleep(500); // Wait for script to start-up

  const tobaccoDivisionInfo = await corpApi['getDivision'](
    DivisionNames.TOBACCO
  );
  const productName = tobaccoDivisionInfo.products.at(-1);
  if (!productName) {
    scriptLogWriter.writeLine(
      'Unable to complete round 3 setup!  No products in development.'
    );
    scriptLogWriter.writeLine('Remaining incomplete steps :');
    scriptLogWriter.writeLine('  - Develop the first product');
    scriptLogWriter.writeLine('  - Setup product development and pricing');
    scriptLogWriter.writeLine('  - Wait for product sales to stabalize');
    scriptLogWriter.writeLine('  - Wait for investment offer of at least $30q');
    return;
  }

  scriptLogWriter.writeLine(
    'Waiting for product development & effectiveness rating...'
  );
  let productInfo = await corpApi['getProduct'](
    DivisionNames.TOBACCO,
    DEFAULT_PRODUCT_DESIGN_OFFICE,
    productName
  );
  while (
    productInfo.developmentProgress < 100 ||
    productInfo.effectiveRating <= 0
  ) {
    let purchasedUpgrades = false;
    corpInfo = await corpApi['getCorporation']();
    const profit = corpInfo.revenue - corpInfo.expenses;
    if (tobaccoDivisionInfo.awareness < Number.MAX_VALUE) {
      const currentWilsonLevel = await corpApi['getUpgradeLevel'](
        UpgradeName.WILSON_ANALYTICS
      );
      const wilsonUpgradeInfo = CorpUpgradesData[UpgradeName.WILSON_ANALYTICS];
      const maxWilsonLevel = getMaxAffordableUpgradeLevel(
        wilsonUpgradeInfo.basePrice,
        wilsonUpgradeInfo.priceMult,
        currentWilsonLevel,
        profit
      );
      if (maxWilsonLevel > currentWilsonLevel) {
        scriptLogWriter.writeLine(
          `  Upgrading Wilson Analytics to level ${maxWilsonLevel}`
        );
        await buyCorpUpgrade(
          nsLocator,
          UpgradeName.WILSON_ANALYTICS,
          maxWilsonLevel
        );
        purchasedUpgrades = true;
      }

      const advertBudget = corpInfo.funds * 0.5;
      const advertLevel = await corpApi['getHireAdVertCount'](
        DivisionNames.AGRICULTURE
      );
      if (profit >= 1e20 && advertBudget >= advertLevel) {
        scriptLogWriter.writeLine('Upgrading Tobacco Division Advert...');
        await buyMaxAdvert(nsLocator, DivisionNames.TOBACCO, advertBudget);
        purchasedUpgrades = true;
      }
    }

    const agrucultureResearchUpgrades = await getAffordableResearchUpgrades(
      nsLocator,
      DivisionNames.AGRICULTURE
    );
    if (agrucultureResearchUpgrades.length > 0) {
      scriptLogWriter.writeLine(
        `  Buying research upgrades for Agriculture Division : ${agrucultureResearchUpgrades}`
      );
      await buyResearchUpgrades(
        nsLocator,
        DivisionNames.AGRICULTURE,
        agrucultureResearchUpgrades
      );
      purchasedUpgrades = true;
    }
    const chemicalResearchUpgrades = await getAffordableResearchUpgrades(
      nsLocator,
      DivisionNames.CHEMICAL
    );
    if (chemicalResearchUpgrades.length > 0) {
      scriptLogWriter.writeLine(
        `  Buying research upgrades for Chemical Division : ${chemicalResearchUpgrades}`
      );
      await buyResearchUpgrades(
        nsLocator,
        DivisionNames.CHEMICAL,
        chemicalResearchUpgrades
      );
      purchasedUpgrades = true;
    }
    const tobaccoResearchUpgrades = await getAffordableResearchUpgrades(
      nsLocator,
      DivisionNames.TOBACCO
    );
    if (tobaccoResearchUpgrades.length > 0) {
      scriptLogWriter.writeLine(
        `  Buying research upgrades for Tobacco Division : ${tobaccoResearchUpgrades}`
      );
      await buyResearchUpgrades(
        nsLocator,
        DivisionNames.TOBACCO,
        tobaccoResearchUpgrades
      );
      purchasedUpgrades = true;
    }

    if (purchasedUpgrades) {
      scriptLogWriter.writeLine(ENTRY_DIVIDER);
    }

    await waitForState(netscript, CorpState.START);
    productInfo = await corpApi['getProduct'](
      DivisionNames.TOBACCO,
      DEFAULT_PRODUCT_DESIGN_OFFICE,
      productName
    );
  }

  scriptLogWriter.writeLine('Waiting for effectiveness rating to stabalize...');
  for (let cyclecCounter = 0; cyclecCounter < 2; cyclecCounter++) {
    await waitForState(netscript, CorpState.START);
  }

  scriptLogWriter.writeLine(
    'Shifting all Product Offices to Production to boost investment offer...'
  );
  for (const cityName of DEFAULT_PRODUCT_RESEARCH_OFFICES) {
    const officeInfo = await corpApi['getOffice'](
      DivisionNames.TOBACCO,
      cityName
    );
    const employeeAssignments = calculateAssignmentCounts(
      officeInfo.size,
      EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE
    );
    const officeAssignments: OfficeAssignments = {
      city: cityName,
      assignments: employeeAssignments,
    };
    await assignEmployees(nsLocator, DivisionNames.TOBACCO, [
      officeAssignments,
    ]);
  }

  scriptLogWriter.writeLine('Corporation Round 3 setup complete!');
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
    scriptLogWriter.writeLine('Wait for an investment offer of at least $30q');
  }
  scriptLogWriter.writeLine(
    'Remember the Product Support Offices are setup for production!'
  );
  scriptLogWriter.writeLine(
    'Round 4 & Public scripts will re-setup the Product Support Divisions for research.'
  );
}

export function autocomplete() {
  return CMD_FLAGS;
}
