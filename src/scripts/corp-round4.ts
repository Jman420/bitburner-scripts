import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {openTail} from '/scripts/workflows/ui';
import {initializeScript, runScript} from '/scripts/workflows/execution';

import {
  CorpState,
  DivisionNames,
  UpgradeName,
} from '/scripts/data/corporation-enums';
import {CorpUpgradesData} from '/scripts/data/corporation-upgrades-data';
import {
  BENCHMARK_OFFICE,
  CMD_FLAG_AUTO_INVESTMENT,
  CMD_FLAG_BYPASS_FUNDS_REQ,
  PRICING_SETUP_SCRIPT,
  PRODUCT_LIFECYCLE_SCRIPT,
  SMART_SUPPLY_SCRIPT,
  TEA_PARTY_SCRIPT,
} from '/scripts/workflows/corporation-shared';
import {
  DEFAULT_PRODUCT_DESIGN_OFFICE,
  DEFAULT_PRODUCT_RESEARCH_OFFICES,
  EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE,
  assignEmployees,
  buyCorpUpgrade,
  buyIndustryMaterials,
  buyMaxAdvert,
  buyResearchUpgrades,
  improveProductDivision,
  improveSupportDivision,
  resetMultiplierMaterialPurchases,
  takeBestInvestmentOffer,
  waitForState,
} from '/scripts/workflows/corporation-actions';
import {
  OfficeAssignments,
  calculateAssignmentCounts,
  getAffordableResearchUpgrades,
  getMaxAffordableUpgradeLevel,
} from '/scripts/workflows/corporation-formulas';
import {
  CmdArgsSchema,
  getCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {
  CMD_FLAG_DESIGN_CITY_NAME,
  CMD_FLAG_DIVISION_NAME,
} from '/scripts/corp-product';
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';
import {killWorkerScripts} from '/scripts/workflows/orchestration';
import {ExitEvent} from '/scripts/comms/events/exit-event';
import {CITY_NAMES} from '/scripts/common/shared';
import {EventListener} from '/scripts/comms/event-comms';

const MODULE_NAME = 'corp-round4';
const SUBSCRIBER_NAME = 'corp-round4';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_AUTO_INVESTMENT, false],
  [CMD_FLAG_BYPASS_FUNDS_REQ, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const TAIL_X_POS = 615;
const TAIL_Y_POS = 930;
const TAIL_WIDTH = 790;
const TAIL_HEIGHT = 415;

const AGRICULTURE_MATERIALS_SPACE_RATIO = 0.1;
const CHEMICAL_MATERIALS_SPACE_RATIO = 0.65;
const TOBACCO_MATERIALS_SPACE_RATIO = 0.85;

export const REQUIRED_FUNDS = 20e15; // 20q

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
  terminalWriter.writeLine('Corporation Automation - Investor Round 4');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const autoInvestment = cmdArgs[CMD_FLAG_AUTO_INVESTMENT].valueOf() as boolean;
  const bypassFundsReq = cmdArgs[
    CMD_FLAG_BYPASS_FUNDS_REQ
  ].valueOf() as boolean;

  terminalWriter.writeLine(`Auto Investment : ${autoInvestment}`);
  terminalWriter.writeLine(`Bypass Funds Requirement : ${bypassFundsReq}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  const corpApi = nsLocator.corporation;
  const investmentOfferInfo = await corpApi['getInvestmentOffer']();
  if (investmentOfferInfo.round !== 4) {
    terminalWriter.writeLine(
      `Invalid investor round : ${investmentOfferInfo.round}.  Script meant for investor round 4.`
    );
    return;
  }

  let tobaccoDivisionInfo = await corpApi['getDivision'](DivisionNames.TOBACCO);
  const latestProductName = tobaccoDivisionInfo.products.at(-1) ?? '';
  if (!latestProductName) {
    terminalWriter.writeLine(
      'Missing Tobacco products.  At least one product must be in production or design.'
    );
    return;
  }

  let corpInfo = await corpApi['getCorporation']();
  if (!bypassFundsReq && corpInfo.funds < REQUIRED_FUNDS) {
    terminalWriter.writeLine(
      `Insufficient funds for round 4.  Required funds : ${netscript.formatNumber(
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
  const scriptArgs = [
    getCmdFlag(CMD_FLAG_DIVISION_NAME),
    DivisionNames.TOBACCO,
    getCmdFlag(CMD_FLAG_DESIGN_CITY_NAME),
    DEFAULT_PRODUCT_DESIGN_OFFICE,
  ];
  runScript(netscript, PRODUCT_LIFECYCLE_SCRIPT, {args: scriptArgs});
  runScript(netscript, PRICING_SETUP_SCRIPT);
  runScript(netscript, SMART_SUPPLY_SCRIPT);
  runScript(netscript, TEA_PARTY_SCRIPT);

  scriptLogWriter.writeLine(
    'Improving Tobacco Division & re-assigning employees...'
  );
  corpInfo = await corpApi['getCorporation']();
  await improveProductDivision(
    nsLocator,
    DivisionNames.TOBACCO,
    corpInfo.funds * 0.99 - 1e9
  );
  await buyIndustryMaterials(
    nsPackage,
    DivisionNames.TOBACCO,
    TOBACCO_MATERIALS_SPACE_RATIO
  );
  await waitForState(netscript, CorpState.START);

  scriptLogWriter.writeLine('Setting up corporate improvement loop...');
  let cycleCount = 0;
  let latestProductInfo = await corpApi['getProduct'](
    DivisionNames.TOBACCO,
    BENCHMARK_OFFICE,
    latestProductName
  );

  scriptLogWriter.writeLine(
    'Improving corporation while waiting for Product development to max out...'
  );
  while (
    tobaccoDivisionInfo.products.length < tobaccoDivisionInfo.maxProducts ||
    latestProductInfo.effectiveRating <= 0
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

      const advertLevel = await corpApi['getHireAdVertCost'](
        DivisionNames.TOBACCO
      );
      const advertBudget = corpInfo.funds * 0.5;
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

    corpInfo = await corpApi['getCorporation']();
    const totalFunds = corpInfo.funds;
    let availableFunds = totalFunds;

    const tobaccoOfficeSize = await corpApi['getOfficeSizeUpgradeCost'](
      DivisionNames.TOBACCO,
      BENCHMARK_OFFICE,
      1
    );
    const upgradeTobacco = 6 * tobaccoOfficeSize < availableFunds * 0.001;
    if (cycleCount % 10 === 0 || upgradeTobacco) {
      const tobaccoBudget = totalFunds * 0.9;
      availableFunds -= tobaccoBudget;
      scriptLogWriter.writeLine(
        `  Upgrading Tobacco division with budget : $${netscript.formatNumber(
          tobaccoBudget
        )}`
      );
      await improveProductDivision(
        nsLocator,
        DivisionNames.TOBACCO,
        tobaccoBudget,
        false
      );
      await buyIndustryMaterials(
        nsPackage,
        DivisionNames.TOBACCO,
        TOBACCO_MATERIALS_SPACE_RATIO
      );
      purchasedUpgrades = true;
    }

    const agricultureOfficeSize = await corpApi['getOfficeSizeUpgradeCost'](
      DivisionNames.AGRICULTURE,
      BENCHMARK_OFFICE,
      1
    );
    const upgradeAgriculture =
      6 * agricultureOfficeSize < availableFunds * 1e-4;
    if (cycleCount % 15 === 0 || upgradeAgriculture) {
      const agricultureBudget = Math.max(
        Math.min(profit * 0.99, totalFunds * 0.09, availableFunds),
        0
      );
      if (agricultureBudget > 0) {
        availableFunds -= agricultureBudget;
        scriptLogWriter.writeLine(
          `  Upgrading Agriculture division with budget : $${netscript.formatNumber(
            agricultureBudget
          )}`
        );
        await improveSupportDivision(
          nsLocator,
          DivisionNames.AGRICULTURE,
          agricultureBudget
        );
        await buyIndustryMaterials(
          nsPackage,
          DivisionNames.AGRICULTURE,
          AGRICULTURE_MATERIALS_SPACE_RATIO
        );
        purchasedUpgrades = true;
      }
    }

    const chemicalOfficeSize = await corpApi['getOfficeSizeUpgradeCost'](
      DivisionNames.CHEMICAL,
      BENCHMARK_OFFICE,
      1
    );
    const upgradeChemical = 6 * chemicalOfficeSize < availableFunds * 1e-5;
    if (cycleCount % 20 === 0 || upgradeChemical) {
      const chemicalBudget = Math.max(
        Math.min(profit * 0.01, totalFunds * 0.01, availableFunds),
        0
      );
      if (chemicalBudget > 0) {
        availableFunds -= chemicalBudget;
        scriptLogWriter.writeLine(
          `  Upgrading Chemical division with budget : $${netscript.formatNumber(
            chemicalBudget
          )}`
        );
        await improveSupportDivision(
          nsLocator,
          DivisionNames.CHEMICAL,
          chemicalBudget
        );
        await buyIndustryMaterials(
          nsPackage,
          DivisionNames.CHEMICAL,
          CHEMICAL_MATERIALS_SPACE_RATIO
        );
        purchasedUpgrades = true;
      }
    }

    if (purchasedUpgrades) {
      scriptLogWriter.writeLine(ENTRY_DIVIDER);
    }

    await waitForState(netscript, CorpState.START);

    tobaccoDivisionInfo = await corpApi['getDivision'](DivisionNames.TOBACCO);
    latestProductInfo = await corpApi['getProduct'](
      DivisionNames.TOBACCO,
      BENCHMARK_OFFICE,
      latestProductName
    );
    cycleCount++;
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

  scriptLogWriter.writeLine('Corporation Round 4 setup complete!');
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
    scriptLogWriter.writeLine('Wait for an investment offer of at least $500Q');
  }
  scriptLogWriter.writeLine('Remeber to sell off the fraudulent divisions!');
  scriptLogWriter.writeLine(
    'Remember the Product Support Offices are setup for production!'
  );
  scriptLogWriter.writeLine(
    'Public script will re-setup the Product Support Divisions for research.'
  );
}

export function autocomplete() {
  return CMD_FLAGS;
}
