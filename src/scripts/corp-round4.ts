import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {openTail} from '/scripts/workflows/ui';
import {initializeScript, runScript} from '/scripts/workflows/execution';

import {
  CorpState,
  DivisionNames,
  ResearchName,
  UpgradeName,
} from '/scripts/data/corporation-enums';
import {CorpUpgradesData} from '/scripts/data/corporation-upgrades-data';
import {
  BENCHMARK_OFFICE,
  PRICING_SETUP_SCRIPT,
  PRODUCT_LIFECYCLE_SCRIPT,
  SMART_SUPPLY_SCRIPT,
  TEA_PARTY_SCRIPT,
} from '/scripts/workflows/corporation-shared';
import {
  DEFAULT_PRODUCT_DESIGN_OFFICE,
  DEFAULT_PRODUCT_RESEARCH_OFFICES,
  EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE,
  EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE_TA2,
  assignEmployees,
  buyCorpUpgrade,
  buyIndustryMaterials,
  buyMaxAdvert,
  buyResearchUpgrades,
  improveProductDivision,
  improveSupportDivision,
  waitForState,
} from '/scripts/workflows/corporation-actions';
import {
  OfficeAssignments,
  calculateAssignmentCounts,
  getAffordableResearchUpgrades,
  getMaxAffordableUpgradeLevel,
} from '/scripts/workflows/corporation-formulas';
import {getCmdFlag} from '/scripts/workflows/cmd-args';
import {
  CMD_FLAG_DESIGN_CITY_NAME,
  CMD_FLAG_DIVISION_NAME,
} from '/scripts/corp-product';

const MODULE_NAME = 'corp-round4';
const SUBSCRIBER_NAME = 'corp-round4';

const TAIL_X_POS = 615;
const TAIL_Y_POS = 979;
const TAIL_WIDTH = 790;
const TAIL_HEIGHT = 365;

const AGRICULTURE_MATERIALS_SPACE_RATIO = 0.1;
const CHEMICAL_MATERIALS_SPACE_RATIO = 0.65;
const TOBACCO_MATERIALS_SPACE_RATIO = 0.85;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporation Automation - Investor Round 4');
  terminalWriter.writeLine(SECTION_DIVIDER);

  const corpApi = netscript.corporation;
  const investmentOfferInfo = corpApi.getInvestmentOffer();
  if (investmentOfferInfo.round !== 4) {
    terminalWriter.writeLine(
      `Invalid investor round : ${investmentOfferInfo.round}.  Script meant for investor round 4.`
    );
    return;
  }

  let tobaccoDivisionInfo = corpApi.getDivision(DivisionNames.TOBACCO);
  const latestProductName = tobaccoDivisionInfo.products.at(-1) ?? '';
  if (!latestProductName) {
    terminalWriter.writeLine(
      'Missing Tobacco products.  At least one product must be in production or design.'
    );
    return;
  }

  terminalWriter.writeLine(
    'See script logs for on-going corporation upgrade details.'
  );
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);

  scriptLogWriter.writeLine('Running required support scripts...');
  runScript(
    netscript,
    PRODUCT_LIFECYCLE_SCRIPT,
    undefined,
    1,
    false,
    getCmdFlag(CMD_FLAG_DIVISION_NAME),
    DivisionNames.TOBACCO,
    getCmdFlag(CMD_FLAG_DESIGN_CITY_NAME),
    DEFAULT_PRODUCT_DESIGN_OFFICE
  );
  runScript(netscript, PRICING_SETUP_SCRIPT);
  runScript(netscript, SMART_SUPPLY_SCRIPT);
  runScript(netscript, TEA_PARTY_SCRIPT);

  scriptLogWriter.writeLine(
    'Improving Tobacco Division & re-assigning employees...'
  );
  const corporationInfo = corpApi.getCorporation();
  improveProductDivision(
    netscript,
    DivisionNames.TOBACCO,
    corporationInfo.funds * 0.99 - 1e9
  );
  await buyIndustryMaterials(
    netscript,
    DivisionNames.TOBACCO,
    TOBACCO_MATERIALS_SPACE_RATIO
  );
  await waitForState(netscript, CorpState.START);

  scriptLogWriter.writeLine('Setting up corporate improvement loop...');
  let cycleCount = 0;
  let latestProductInfo = corpApi.getProduct(
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
    let corporationInfo = corpApi.getCorporation();
    const profit = corporationInfo.revenue - corporationInfo.expenses;
    if (tobaccoDivisionInfo.awareness < Number.MAX_VALUE) {
      const currentWilsonLevel = corpApi.getUpgradeLevel(
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
        buyCorpUpgrade(netscript, UpgradeName.WILSON_ANALYTICS, maxWilsonLevel);
        purchasedUpgrades = true;
      }

      const advertBudget = corporationInfo.funds * 0.5;
      if (
        profit >= 1e20 &&
        advertBudget >= corpApi.getHireAdVertCost(DivisionNames.TOBACCO)
      ) {
        scriptLogWriter.writeLine('Upgrading Tobacco Division Advert...');
        buyMaxAdvert(netscript, DivisionNames.TOBACCO, advertBudget);
        purchasedUpgrades = true;
      }
    }

    const agrucultureResearchUpgrades = getAffordableResearchUpgrades(
      netscript,
      DivisionNames.AGRICULTURE
    );
    if (agrucultureResearchUpgrades.length > 0) {
      scriptLogWriter.writeLine(
        `  Buying research upgrades for Agriculture Division : ${agrucultureResearchUpgrades}`
      );
      buyResearchUpgrades(
        netscript,
        DivisionNames.AGRICULTURE,
        agrucultureResearchUpgrades
      );
      purchasedUpgrades = true;
    }
    const chemicalResearchUpgrades = getAffordableResearchUpgrades(
      netscript,
      DivisionNames.CHEMICAL
    );
    if (chemicalResearchUpgrades.length > 0) {
      scriptLogWriter.writeLine(
        `  Buying research upgrades for Chemical Division : ${chemicalResearchUpgrades}`
      );
      buyResearchUpgrades(
        netscript,
        DivisionNames.CHEMICAL,
        chemicalResearchUpgrades
      );
      purchasedUpgrades = true;
    }
    const tobaccoResearchUpgrades = getAffordableResearchUpgrades(
      netscript,
      DivisionNames.TOBACCO
    );
    if (tobaccoResearchUpgrades.length > 0) {
      scriptLogWriter.writeLine(
        `  Buying research upgrades for Tobacco Division : ${tobaccoResearchUpgrades}`
      );
      buyResearchUpgrades(
        netscript,
        DivisionNames.TOBACCO,
        tobaccoResearchUpgrades
      );
      purchasedUpgrades = true;
    }

    corporationInfo = corpApi.getCorporation();
    const totalFunds = corporationInfo.funds;
    let availableFunds = totalFunds;

    const upgradeTobacco =
      6 *
        corpApi.getOfficeSizeUpgradeCost(
          DivisionNames.TOBACCO,
          BENCHMARK_OFFICE,
          1
        ) <
      availableFunds * 0.001;
    if (cycleCount % 10 === 0 || upgradeTobacco) {
      const tobaccoBudget = totalFunds * 0.9;
      availableFunds -= tobaccoBudget;
      scriptLogWriter.writeLine(
        `  Upgrading Tobacco division with budget : $${netscript.formatNumber(
          tobaccoBudget
        )}`
      );
      improveProductDivision(
        netscript,
        DivisionNames.TOBACCO,
        tobaccoBudget,
        false
      );
      buyIndustryMaterials(
        netscript,
        DivisionNames.TOBACCO,
        TOBACCO_MATERIALS_SPACE_RATIO
      );
      purchasedUpgrades = true;
    }

    const upgradeAgriculture =
      6 *
        corpApi.getOfficeSizeUpgradeCost(
          DivisionNames.AGRICULTURE,
          BENCHMARK_OFFICE,
          1
        ) <
      availableFunds * 1e-4;
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
        improveSupportDivision(
          netscript,
          DivisionNames.AGRICULTURE,
          agricultureBudget
        );
        buyIndustryMaterials(
          netscript,
          DivisionNames.AGRICULTURE,
          AGRICULTURE_MATERIALS_SPACE_RATIO
        );
        purchasedUpgrades = true;
      }
    }

    const upgradeChemical =
      6 *
        corpApi.getOfficeSizeUpgradeCost(
          DivisionNames.CHEMICAL,
          BENCHMARK_OFFICE,
          1
        ) <
      availableFunds * 1e-5;
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
        improveSupportDivision(
          netscript,
          DivisionNames.CHEMICAL,
          chemicalBudget
        );
        buyIndustryMaterials(
          netscript,
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

    tobaccoDivisionInfo = corpApi.getDivision(DivisionNames.TOBACCO);
    latestProductInfo = corpApi.getProduct(
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
    const officeInfo = corpApi.getOffice(DivisionNames.TOBACCO, cityName);
    const assignmentRatios = corpApi.hasResearched(
      DivisionNames.TOBACCO,
      ResearchName.MARKET_TA_2
    )
      ? EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE_TA2
      : EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE;
    const employeeAssignments = calculateAssignmentCounts(
      officeInfo.size,
      assignmentRatios
    );
    const officeAssignments: OfficeAssignments = {
      city: cityName,
      assignments: employeeAssignments,
    };
    assignEmployees(netscript, DivisionNames.TOBACCO, [officeAssignments]);
  }

  scriptLogWriter.writeLine('Waiting for investment offer to stabalize...');
  for (let cyclecCounter = 0; cyclecCounter < 15; cyclecCounter++) {
    await waitForState(netscript, CorpState.START);
  }

  scriptLogWriter.writeLine('Corporation Round 4 setup complete!');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  scriptLogWriter.writeLine('Wait for an investment offer of at least $500Q');
  scriptLogWriter.writeLine('Remeber to sell off the fraudulent divisions!');
  scriptLogWriter.writeLine(
    'Remember the Product Support Offices are setup for production!'
  );
  scriptLogWriter.writeLine(
    'Public script will re-setup the Product Support Divisions for research.'
  );
}
