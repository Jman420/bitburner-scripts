import {
  CityName,
  CorpIndustryName,
  CorpMaterialName,
  CorpStateName,
  NS,
} from '@ns';

import {
  DivisionNames,
  EmployeePosition,
  IndustryType,
  MaterialName,
  ResearchName,
  UpgradeName,
} from '/scripts/data/corporation-enums';
import {CorpUpgradesData} from '/scripts/data/corporation-upgrades-data';

import {CITY_NAMES} from '/scripts/common/shared';

import {
  BENCHMARK_OFFICE,
  EXPORT_FORMULA,
  FRAUD_DIVISION_NAME_PREFIX,
} from '/scripts/workflows/corporation-shared';
import {
  OfficeAssignments,
  addStockedIndustryMaterials,
  calculateAssignmentCounts,
  getMaxAffordableAdvertLevel,
  getMaxAffordableOfficeSize,
  getMaxAffordableUpgradeLevel,
  getMaxAffordableWarehouseLevel,
} from '/scripts/workflows/corporation-formulas';
import {
  getOptimalAdvert,
  getOptimalDivisionFactoryAndStorage,
  getOptimalIndustryMaterials,
} from '/scripts/workflows/corporation-optimization';

const BUDGET_RATIO_PRODUCT_DIVISION = {
  rawProduction: 0.17,
  wilsonAdvert: 0.32,
  office: 0.14,
  employeeStatUpgrades: 0.14,
  salesBot: 0.03,
  projectInsight: 0.17,
};
const BUDGET_RATIO_PRODUCT_DIVISION_MAX_ADVERT = {
  rawProduction: 0.332,
  wilsonAdvert: 0,
  office: 0.267,
  employeeStatUpgrades: 0.267,
  salesBot: 0.067,
  projectInsight: 0.067,
};
const BUDGET_RATIO_SUPPORT_DIVISION = {
  office: 0.9,
  warehouse: 0.1,
};

const EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE = new Map<EmployeePosition, number>([
  [EmployeePosition.OPERATIONS, 0.29],
  [EmployeePosition.ENGINEER, 0.29],
  [EmployeePosition.BUSINESS, 1],
  [EmployeePosition.MANAGEMENT, 0.42],
]);
const EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE_TA2 = new Map<
  EmployeePosition,
  number
>([
  [EmployeePosition.OPERATIONS, 0.06],
  [EmployeePosition.ENGINEER, 0.3],
  [EmployeePosition.BUSINESS, 0.08],
  [EmployeePosition.MANAGEMENT, 0.56],
]);
const EMPLOYEE_RATIO_MATERIAL_OFFICE = new Map<EmployeePosition, number>([
  [EmployeePosition.OPERATIONS, 0.22],
  [EmployeePosition.ENGINEER, 0.63],
  [EmployeePosition.BUSINESS, 1],
  [EmployeePosition.MANAGEMENT, 0.15],
]);

const DEFAULT_PRODUCT_DESIGN_OFFICE = 'Sector-12' as CityName;
const DEFAULT_PRODUCT_RESEARCH_OFFICES = CITY_NAMES.filter(
  value => value !== DEFAULT_PRODUCT_DESIGN_OFFICE
);

const MATERIAL_DIVISION_RESERVED_SPACE_RATIO = 0.15;
const PRODUCT_DIVISION_RESERVED_SPACE_RATIO = 0.1;

async function waitForState(netscript: NS, state: CorpStateName) {
  /* eslint-disable-next-line no-empty */
  while (state !== (await netscript.corporation.nextUpdate())) {}
}

async function waitForResearch(
  netscript: NS,
  divisionName: string,
  targetResearchPoints: number
) {
  const corpApi = netscript.corporation;
  let divisionInfo = corpApi.getDivision(divisionName);
  while (divisionInfo.researchPoints < targetResearchPoints) {
    await corpApi.nextUpdate();
    divisionInfo = corpApi.getDivision(divisionName);
  }
}

async function waitForMoraleAndEnergy(
  netscript: NS,
  divisionName: string,
  targetMorale = 100,
  targetEnergy = 100
) {
  const corpApi = netscript.corporation;
  const officesMaxedOut = new Set<CityName>();
  while (officesMaxedOut.size < CITY_NAMES.length) {
    for (const cityName of CITY_NAMES) {
      const officeInfo = corpApi.getOffice(divisionName, cityName);
      if (
        officeInfo.avgMorale >= targetMorale &&
        officeInfo.avgEnergy >= targetEnergy
      ) {
        officesMaxedOut.add(cityName);
      }
    }
    await waitForState(netscript, 'START');
  }
}

async function buyMaterial(
  netscript: NS,
  divisionName: string,
  cityName: CityName,
  materialName: CorpMaterialName,
  amount: number
) {
  const corpApi = netscript.corporation;
  const buyAmount = amount / 10;
  corpApi.buyMaterial(divisionName, cityName, materialName, buyAmount);
  await waitForState(netscript, 'PURCHASE');
  corpApi.buyMaterial(divisionName, cityName, materialName, 0);
}

async function sellMaterial(
  netscript: NS,
  divisionName: string,
  cityName: CityName,
  materialName: CorpMaterialName,
  amount: number
) {
  const corpApi = netscript.corporation;
  let materialInfo = corpApi.getMaterial(divisionName, cityName, materialName);
  const targetAmount = materialInfo.stored - amount;
  while (materialInfo.stored > targetAmount && materialInfo.stored > 0) {
    const sellAmount = materialInfo.stored - targetAmount;
    corpApi.sellMaterial(
      divisionName,
      cityName,
      materialName,
      `${sellAmount}`,
      'MP'
    );
    await waitForState(netscript, 'PURCHASE');
    corpApi.sellMaterial(divisionName, cityName, materialName, '0', 'MP');

    materialInfo = corpApi.getMaterial(divisionName, cityName, materialName);
  }
}

function manageIndustryMaterials(
  netscript: NS,
  divisionName: string,
  cities: CityName[],
  industryMaterials: Map<CorpMaterialName, number>
) {
  const corpApi = netscript.corporation;
  const divisionInfo = corpApi.getDivision(divisionName);
  const industryInfo = corpApi.getIndustryData(divisionInfo.type);
  const reservedSpaceRatio = industryInfo.makesMaterials
    ? MATERIAL_DIVISION_RESERVED_SPACE_RATIO
    : PRODUCT_DIVISION_RESERVED_SPACE_RATIO;
  const result = new Array<Promise<void>>();
  for (const cityName of cities) {
    const warehouseInfo = corpApi.getWarehouse(divisionName, cityName);
    const availableSpace = warehouseInfo.size - warehouseInfo.sizeUsed;

    for (const [materialName, targetAmount] of industryMaterials.entries()) {
      const materialInfo = corpApi.getMaterial(
        divisionName,
        cityName,
        materialName
      );
      const amountDifference = targetAmount - materialInfo.stored;
      if (amountDifference > 0) {
        if (availableSpace < warehouseInfo.size * reservedSpaceRatio) {
          continue;
        }
        result.push(
          buyMaterial(
            netscript,
            divisionName,
            cityName,
            materialName,
            amountDifference
          )
        );
      } else if (amountDifference < 0) {
        result.push(
          sellMaterial(
            netscript,
            divisionName,
            cityName,
            materialName,
            -amountDifference
          )
        );
      }
    }
  }
  return result;
}

async function buyIndustryMaterials(
  netscript: NS,
  divisionName: DivisionNames,
  spaceRatio: number
) {
  const corpApi = netscript.corporation;
  const divisionInfo = corpApi.getDivision(divisionName);
  const warehouseInfo = corpApi.getWarehouse(divisionName, BENCHMARK_OFFICE);
  const optimalIndustryMaterials = addStockedIndustryMaterials(
    netscript,
    divisionName,
    getOptimalIndustryMaterials(
      netscript,
      divisionInfo.type,
      (warehouseInfo.size - warehouseInfo.sizeUsed) * spaceRatio
    )
  );
  await Promise.allSettled(
    manageIndustryMaterials(
      netscript,
      divisionName,
      CITY_NAMES,
      optimalIndustryMaterials
    )
  );
}

function hireEmployees(
  netscript: NS,
  divisionName: string,
  cityName: CityName
) {
  while (
    netscript.corporation.hireEmployee(
      divisionName,
      cityName,
      EmployeePosition.RESEARCH_DEVELOPMENT
    )
  );
}

function createDivision(
  netscript: NS,
  divisionName: string,
  industryType: CorpIndustryName
) {
  const corpApi = netscript.corporation;
  const corporationInfo = corpApi.getCorporation();

  if (!corporationInfo.divisions.includes(divisionName)) {
    corpApi.expandIndustry(industryType, divisionName);
  }
  const divisionInfo = corpApi.getDivision(divisionName);

  for (const cityName of CITY_NAMES) {
    if (!divisionInfo.cities.includes(cityName)) {
      corpApi.expandCity(divisionName, cityName);
    }
    if (!corpApi.hasWarehouse(divisionName, cityName)) {
      corpApi.purchaseWarehouse(divisionName, cityName);
    }
    hireEmployees(netscript, divisionName, cityName);
  }
  return corpApi.getDivision(divisionName);
}

function createFraudDivisions(netscript: NS, totalDivisions: number) {
  const corpApi = netscript.corporation;
  const corporationInfo = corpApi.getCorporation();
  for (
    let divisionCounter = 0;
    divisionCounter < totalDivisions;
    divisionCounter++
  ) {
    const divisionName = `${FRAUD_DIVISION_NAME_PREFIX}${divisionCounter
      .toString()
      .padStart(2, '0')}`;
    if (!corporationInfo.divisions.includes(divisionName)) {
      corpApi.expandIndustry(IndustryType.RESTAURANT, divisionName);
    }
  }
}

function buyCorpUpgrade(
  netscript: NS,
  upgradeName: UpgradeName,
  targetLevel: number
) {
  const corpApi = netscript.corporation;
  for (
    let upgradeCounter = corpApi.getUpgradeLevel(upgradeName);
    upgradeCounter < targetLevel;
    upgradeCounter++
  ) {
    corpApi.levelUpgrade(upgradeName);
  }
  return corpApi.getUpgradeLevel(upgradeName);
}

function buyAdvert(netscript: NS, divisionName: string, targetLevel: number) {
  const corpApi = netscript.corporation;
  for (
    let advertCounter = corpApi.getHireAdVertCount(divisionName);
    advertCounter < targetLevel;
    advertCounter++
  ) {
    corpApi.hireAdVert(divisionName);
  }
  return corpApi.getHireAdVertCount(divisionName);
}

function buyMaxAdvert(
  netscript: NS,
  divisionName: string,
  divisionBudget: number
) {
  const corpApi = netscript.corporation;
  const currentLevel = corpApi.getHireAdVertCount(divisionName);
  const maxLevel = getMaxAffordableAdvertLevel(currentLevel, divisionBudget);

  buyAdvert(netscript, divisionName, maxLevel);
}

function upgradeWarehouse(
  netscript: NS,
  divisionName: string,
  cityName: CityName,
  targetLevel: number
) {
  const corpApi = netscript.corporation;
  const buyAmount =
    targetLevel - corpApi.getWarehouse(divisionName, cityName).level;
  if (buyAmount > 0) {
    corpApi.upgradeWarehouse(divisionName, cityName, buyAmount);
  }
}

function upgradeOffices(
  netscript: NS,
  divisionName: string,
  cities: CityName[],
  officeSize: number
) {
  const corpApi = netscript.corporation;
  for (const cityName of cities) {
    const officeInfo = corpApi.getOffice(divisionName, cityName);
    if (officeInfo.size < officeSize) {
      corpApi.upgradeOfficeSize(
        divisionName,
        cityName,
        officeSize - officeInfo.size
      );
      hireEmployees(netscript, divisionName, cityName);
    }
  }
}

function assignEmployees(
  netscript: NS,
  divisionName: string,
  officeAssignments: OfficeAssignments[]
) {
  const corpApi = netscript.corporation;

  for (const assigments of officeAssignments) {
    for (const employeePosition of Object.values(EmployeePosition)) {
      corpApi.setAutoJobAssignment(
        divisionName,
        assigments.city,
        employeePosition,
        0
      );
    }
    for (const [
      assignedPosition,
      workerAmount,
    ] of assigments.assignments.entries()) {
      corpApi.setAutoJobAssignment(
        divisionName,
        assigments.city,
        assignedPosition,
        workerAmount
      );
    }
  }
}

function setupExport(
  netscript: NS,
  sourceDivisionName: string,
  sourceCityName: CityName,
  targetDivisionName: string,
  targetCityName: CityName,
  materialName: MaterialName
) {
  const corpApi = netscript.corporation;
  corpApi.cancelExportMaterial(
    sourceDivisionName,
    sourceCityName,
    targetDivisionName,
    targetCityName,
    materialName
  );
  corpApi.exportMaterial(
    sourceDivisionName,
    sourceCityName,
    targetDivisionName,
    targetCityName,
    materialName,
    EXPORT_FORMULA
  );
}

function removeAllExports(
  netscript: NS,
  sourceDivisionName: string,
  sourceCityName: CityName,
  materialName: MaterialName
) {
  const corpApi = netscript.corporation;
  const materialInfo = corpApi.getMaterial(
    sourceDivisionName,
    sourceCityName,
    materialName
  );
  for (const exportInfo of materialInfo.exports) {
    corpApi.cancelExportMaterial(
      sourceDivisionName,
      sourceCityName,
      exportInfo.division,
      exportInfo.city,
      materialName
    );
  }
}

function improveProductDivision(
  netscript: NS,
  divisionName: string,
  budget: number,
  upgradeAdvert = true
) {
  const corpApi = netscript.corporation;
  const divisionInfo = corpApi.getDivision(divisionName);
  const budgetRatios =
    divisionInfo.awareness === Number.MAX_VALUE
      ? BUDGET_RATIO_PRODUCT_DIVISION_MAX_ADVERT
      : BUDGET_RATIO_PRODUCT_DIVISION;

  const employeeStatsUpgradeBudget =
    (budget * budgetRatios.employeeStatUpgrades) / 4;
  const currentCreativityUpgradeLevel = corpApi.getUpgradeLevel(
    UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS
  );
  const creativityUpgradeInfo =
    CorpUpgradesData[UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS];
  const currentCharismaUpgradeLevel = corpApi.getUpgradeLevel(
    UpgradeName.SPEECH_PROCESSOR_IMPLANTS
  );
  const charismaUpgradeInfo =
    CorpUpgradesData[UpgradeName.SPEECH_PROCESSOR_IMPLANTS];
  const currentIntelligenceUpgradeLevel = corpApi.getUpgradeLevel(
    UpgradeName.NEURAL_ACCELERATORS
  );
  const intelligenceUpgradeInfo =
    CorpUpgradesData[UpgradeName.NEURAL_ACCELERATORS];
  const currentEfficiencyUpgradeLevel = corpApi.getUpgradeLevel(
    UpgradeName.FOCUS_WIRES
  );
  const efficiencyUpgradeInfo = CorpUpgradesData[UpgradeName.FOCUS_WIRES];

  buyCorpUpgrade(
    netscript,
    UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS,
    getMaxAffordableUpgradeLevel(
      creativityUpgradeInfo.basePrice,
      creativityUpgradeInfo.priceMult,
      currentCreativityUpgradeLevel,
      employeeStatsUpgradeBudget
    )
  );
  buyCorpUpgrade(
    netscript,
    UpgradeName.SPEECH_PROCESSOR_IMPLANTS,
    getMaxAffordableUpgradeLevel(
      charismaUpgradeInfo.basePrice,
      charismaUpgradeInfo.priceMult,
      currentCharismaUpgradeLevel,
      employeeStatsUpgradeBudget
    )
  );
  buyCorpUpgrade(
    netscript,
    UpgradeName.NEURAL_ACCELERATORS,
    getMaxAffordableUpgradeLevel(
      intelligenceUpgradeInfo.basePrice,
      intelligenceUpgradeInfo.priceMult,
      currentIntelligenceUpgradeLevel,
      employeeStatsUpgradeBudget
    )
  );
  buyCorpUpgrade(
    netscript,
    UpgradeName.FOCUS_WIRES,
    getMaxAffordableUpgradeLevel(
      efficiencyUpgradeInfo.basePrice,
      efficiencyUpgradeInfo.priceMult,
      currentEfficiencyUpgradeLevel,
      employeeStatsUpgradeBudget
    )
  );

  const salesBotBudget = budget * budgetRatios.salesBot;
  const currentSalesBotLevel = corpApi.getUpgradeLevel(
    UpgradeName.ABC_SALES_BOTS
  );
  const salesBotUpgradeInfo = CorpUpgradesData[UpgradeName.ABC_SALES_BOTS];
  buyCorpUpgrade(
    netscript,
    UpgradeName.ABC_SALES_BOTS,
    getMaxAffordableUpgradeLevel(
      salesBotUpgradeInfo.basePrice,
      salesBotUpgradeInfo.priceMult,
      currentSalesBotLevel,
      salesBotBudget
    )
  );

  const projectInsightBudget = budget * budgetRatios.projectInsight;
  const currentProjectInsightLevel = corpApi.getUpgradeLevel(
    UpgradeName.PROJECT_INSIGHT
  );
  const projectInsightUpgradeInfo =
    CorpUpgradesData[UpgradeName.PROJECT_INSIGHT];
  buyCorpUpgrade(
    netscript,
    UpgradeName.PROJECT_INSIGHT,
    getMaxAffordableUpgradeLevel(
      projectInsightUpgradeInfo.basePrice,
      projectInsightUpgradeInfo.priceMult,
      currentProjectInsightLevel,
      projectInsightBudget
    )
  );

  const rawProductionBudget = budget * budgetRatios.rawProduction;
  const optimalFactoryStorageUpgrades = getOptimalDivisionFactoryAndStorage(
    netscript,
    divisionName,
    rawProductionBudget
  );
  if (optimalFactoryStorageUpgrades) {
    buyCorpUpgrade(
      netscript,
      UpgradeName.SMART_STORAGE,
      optimalFactoryStorageUpgrades.smartStorageLevel
    );
    buyCorpUpgrade(
      netscript,
      UpgradeName.SMART_FACTORIES,
      optimalFactoryStorageUpgrades.smartFactoriesLevel
    );
    for (const cityName of CITY_NAMES) {
      const warehouseInfo = corpApi.getWarehouse(divisionName, cityName);
      if (warehouseInfo.level < optimalFactoryStorageUpgrades.warehouseLevel) {
        corpApi.upgradeWarehouse(
          divisionName,
          cityName,
          optimalFactoryStorageUpgrades.warehouseLevel - warehouseInfo.level
        );
      }
    }
  }

  if (upgradeAdvert) {
    const advertisingBudget = budget * budgetRatios.wilsonAdvert;
    const optimalAdvertisingUpgrades = getOptimalAdvert(
      netscript,
      divisionName,
      advertisingBudget
    );
    if (optimalAdvertisingUpgrades) {
      buyCorpUpgrade(
        netscript,
        UpgradeName.WILSON_ANALYTICS,
        optimalAdvertisingUpgrades.wilsonLevel
      );
      buyAdvert(
        netscript,
        divisionName,
        optimalAdvertisingUpgrades.advertLevel
      );
    }
  }

  const officeBudget = budget * budgetRatios.office;
  improveProductDivisionOffices(netscript, divisionName, officeBudget);
}

function improveProductDivisionOffices(
  netscript: NS,
  divisionName: string,
  budget: number
) {
  improveProductMainOffice(netscript, divisionName, budget * 0.5);
  improveProductSupportOffices(netscript, divisionName, budget * 0.5);
}

function improveProductMainOffice(
  netscript: NS,
  divisionName: string,
  budget: number
) {
  const corpApi = netscript.corporation;
  const officeInfo = corpApi.getOffice(
    divisionName,
    DEFAULT_PRODUCT_DESIGN_OFFICE
  );
  const maxOfficeSize = getMaxAffordableOfficeSize(officeInfo.size, budget);
  if (officeInfo.size > maxOfficeSize) {
    return;
  }

  const assignmentRatios = corpApi.hasResearched(
    divisionName,
    ResearchName.MARKET_TA_2
  )
    ? EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE_TA2
    : EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE;
  const employeeAssignments = calculateAssignmentCounts(
    maxOfficeSize,
    assignmentRatios
  );
  const officeAssignments: OfficeAssignments = {
    city: DEFAULT_PRODUCT_DESIGN_OFFICE,
    assignments: employeeAssignments,
  };

  upgradeOffices(
    netscript,
    divisionName,
    [DEFAULT_PRODUCT_DESIGN_OFFICE],
    maxOfficeSize
  );
  assignEmployees(netscript, divisionName, [officeAssignments]);
}

function improveProductSupportOffices(
  netscript: NS,
  divisionName: string,
  budget: number
) {
  const corpApi = netscript.corporation;
  const officeBudget = budget / 5;

  for (const cityName of DEFAULT_PRODUCT_RESEARCH_OFFICES) {
    const officeInfo = corpApi.getOffice(divisionName, cityName);
    const maxOfficeSize = getMaxAffordableOfficeSize(
      officeInfo.size,
      officeBudget
    );
    if (maxOfficeSize < 5 || officeInfo.size > maxOfficeSize) {
      continue;
    }

    const employeeAssignments = new Map<EmployeePosition, number>([
      [EmployeePosition.OPERATIONS, 1],
      [EmployeePosition.ENGINEER, 1],
      [EmployeePosition.BUSINESS, 1],
      [EmployeePosition.MANAGEMENT, 1],
      [EmployeePosition.RESEARCH_DEVELOPMENT, maxOfficeSize - 4],
    ]);
    const officeAssignments: OfficeAssignments = {
      city: cityName,
      assignments: employeeAssignments,
    };

    upgradeOffices(netscript, divisionName, [cityName], maxOfficeSize);
    assignEmployees(netscript, divisionName, [officeAssignments]);
  }
}

function improveSupportDivision(
  netscript: NS,
  divisionName: string,
  budget: number
) {
  const corpApi = netscript.corporation;

  const warehouseBudget =
    (budget * BUDGET_RATIO_SUPPORT_DIVISION.warehouse) / 6;
  const officeBudget = (budget * BUDGET_RATIO_SUPPORT_DIVISION.office) / 6;
  for (const cityName of CITY_NAMES) {
    const warehouseInfo = corpApi.getWarehouse(divisionName, cityName);
    const maxWarehouseLevel = getMaxAffordableWarehouseLevel(
      warehouseInfo.level,
      warehouseBudget
    );
    if (maxWarehouseLevel > warehouseInfo.level) {
      corpApi.upgradeWarehouse(
        divisionName,
        cityName,
        maxWarehouseLevel - warehouseInfo.level
      );
    }

    let officeInfo = corpApi.getOffice(divisionName, cityName);
    const maxOfficeSize = getMaxAffordableOfficeSize(
      officeInfo.size,
      officeBudget
    );
    upgradeOffices(netscript, divisionName, [cityName], maxOfficeSize);

    officeInfo = corpApi.getOffice(divisionName, cityName);
    const upgradedOfficeSize = officeInfo.size;
    const researchAssignmentCount = Math.min(
      Math.floor(upgradedOfficeSize * 0.2),
      upgradedOfficeSize - 3
    );
    const nonResearchAssignmentCount =
      upgradedOfficeSize - researchAssignmentCount;
    const employeeAssignments = calculateAssignmentCounts(
      nonResearchAssignmentCount,
      EMPLOYEE_RATIO_MATERIAL_OFFICE
    );
    employeeAssignments.set(
      EmployeePosition.RESEARCH_DEVELOPMENT,
      researchAssignmentCount
    );
    const officeAssignments: OfficeAssignments = {
      city: cityName,
      assignments: employeeAssignments,
    };
    assignEmployees(netscript, divisionName, [officeAssignments]);
  }
}

function buyResearchUpgrades(
  netscript: NS,
  divisionName: string,
  researchUpgrades: ResearchName[]
) {
  const corpApi = netscript.corporation;
  for (const upgradeName of researchUpgrades) {
    if (!corpApi.hasResearched(divisionName, upgradeName)) {
      corpApi.research(divisionName, upgradeName);
    }
  }
}

export {
  DEFAULT_PRODUCT_DESIGN_OFFICE,
  DEFAULT_PRODUCT_RESEARCH_OFFICES,
  EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE,
  EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE_TA2,
  waitForState,
  waitForResearch,
  waitForMoraleAndEnergy,
  buyMaterial,
  sellMaterial,
  manageIndustryMaterials,
  buyIndustryMaterials,
  createDivision,
  createFraudDivisions,
  buyCorpUpgrade,
  buyAdvert,
  buyMaxAdvert,
  upgradeWarehouse,
  upgradeOffices,
  assignEmployees,
  setupExport,
  removeAllExports,
  improveProductDivision,
  improveSupportDivision,
  buyResearchUpgrades,
};
