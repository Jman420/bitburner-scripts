import {NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {openTail} from '/scripts/workflows/ui';
import {
  delayedInfiniteLoop,
  initializeScript,
  runScript,
} from '/scripts/workflows/execution';

import {
  CMD_FLAG_DESIGN_CITY_NAME,
  CMD_FLAG_DIVISION_NAME,
} from '/scripts/corp-product';
import {getCmdFlag} from '/scripts/workflows/cmd-args';

import {
  CorpState,
  DivisionNames,
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
  buyCorpUpgrade,
  buyIndustryMaterials,
  buyMaxAdvert,
  buyResearchUpgrades,
  improveProductDivision,
  improveSupportDivision,
  waitForState,
} from '/scripts/workflows/corporation-actions';
import {
  getAffordableResearchUpgrades,
  getMaxAffordableUpgradeLevel,
} from '/scripts/workflows/corporation-formulas';

const MODULE_NAME = 'corp-public';
const SUBSCRIBER_NAME = 'corp-public';

const TAIL_X_POS = 615;
const TAIL_Y_POS = 979;
const TAIL_WIDTH = 790;
const TAIL_HEIGHT = 365;

const MATERIALS_SPACE_RATIO = 0.1;

const UPDATE_DELAY = 0;

let cycleCount: number;

async function manageDivisionImprovements(netscript: NS, logWriter: Logger) {
  let purchasedUpgrades = false;
  const corpApi = netscript.corporation;
  let corporationInfo = corpApi.getCorporation();
  const profit = corporationInfo.revenue - corporationInfo.expenses;
  const tobaccoDivisionInfo = corpApi.getDivision(DivisionNames.TOBACCO);
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
      logWriter.writeLine(
        `Upgrading Wilson Analytics to level ${maxWilsonLevel}`
      );
      buyCorpUpgrade(netscript, UpgradeName.WILSON_ANALYTICS, maxWilsonLevel);
      purchasedUpgrades = true;
    }

    const advertBudget = corporationInfo.funds * 0.5;
    if (
      profit >= 1e20 &&
      advertBudget >= corpApi.getHireAdVertCost(DivisionNames.TOBACCO)
    ) {
      logWriter.writeLine('Upgrading Tobacco Division Advert...');
      buyMaxAdvert(netscript, DivisionNames.TOBACCO, advertBudget);
      purchasedUpgrades = true;
    }
  }

  const agrucultureResearchUpgrades = getAffordableResearchUpgrades(
    netscript,
    DivisionNames.AGRICULTURE
  );
  if (agrucultureResearchUpgrades.length > 0) {
    logWriter.writeLine(
      `Buying research upgrades for Agriculture Division : ${agrucultureResearchUpgrades}`
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
    logWriter.writeLine(
      `Buying research upgrades for Chemical Division : ${chemicalResearchUpgrades}`
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
    logWriter.writeLine(
      `Buying research upgrades for Tobacco Division : ${tobaccoResearchUpgrades}`
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
    logWriter.writeLine(
      `Upgrading Tobacco division with budget : $${netscript.formatNumber(
        tobaccoBudget
      )}`
    );
    const origWarehouseInfo = corpApi.getWarehouse(
      DivisionNames.TOBACCO,
      BENCHMARK_OFFICE
    );
    improveProductDivision(
      netscript,
      DivisionNames.TOBACCO,
      tobaccoBudget,
      false
    );
    const improvedWarehouseInfo = corpApi.getWarehouse(
      DivisionNames.TOBACCO,
      BENCHMARK_OFFICE
    );
    if (improvedWarehouseInfo.size > origWarehouseInfo.size) {
      buyIndustryMaterials(
        netscript,
        DivisionNames.TOBACCO,
        MATERIALS_SPACE_RATIO
      );
    }
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
      logWriter.writeLine(
        `Upgrading Agriculture division with budget : $${netscript.formatNumber(
          agricultureBudget
        )}`
      );
      const origWarehouseInfo = corpApi.getWarehouse(
        DivisionNames.AGRICULTURE,
        BENCHMARK_OFFICE
      );
      improveSupportDivision(
        netscript,
        DivisionNames.AGRICULTURE,
        agricultureBudget
      );
      const improvedWarehouseInfo = corpApi.getWarehouse(
        DivisionNames.AGRICULTURE,
        BENCHMARK_OFFICE
      );
      if (improvedWarehouseInfo.size > origWarehouseInfo.size) {
        buyIndustryMaterials(
          netscript,
          DivisionNames.AGRICULTURE,
          MATERIALS_SPACE_RATIO
        );
      }
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
      logWriter.writeLine(
        `Upgrading Chemical division with budget : $${netscript.formatNumber(
          chemicalBudget
        )}`
      );
      const origWarehouseInfo = corpApi.getWarehouse(
        DivisionNames.CHEMICAL,
        BENCHMARK_OFFICE
      );
      improveSupportDivision(netscript, DivisionNames.CHEMICAL, chemicalBudget);
      const improvedWarehouseInfo = corpApi.getWarehouse(
        DivisionNames.CHEMICAL,
        BENCHMARK_OFFICE
      );
      if (improvedWarehouseInfo.size > origWarehouseInfo.size) {
        buyIndustryMaterials(
          netscript,
          DivisionNames.CHEMICAL,
          MATERIALS_SPACE_RATIO
        );
      }
      purchasedUpgrades = true;
    }
  }

  if (purchasedUpgrades) {
    logWriter.writeLine(ENTRY_DIVIDER);
  }

  cycleCount++;
  await waitForState(netscript, CorpState.START);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporation Automation - Public');
  terminalWriter.writeLine(SECTION_DIVIDER);

  const corpApi = netscript.corporation;
  const corporationInfo = corpApi.getCorporation();
  if (!corporationInfo.public) {
    terminalWriter.writeLine(
      'Invalid corporation state.  Script meant for public corporation.'
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

  scriptLogWriter.writeLine('Running corporate improvement loop...');
  cycleCount = 0;
  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    manageDivisionImprovements,
    netscript,
    scriptLogWriter
  );
}
