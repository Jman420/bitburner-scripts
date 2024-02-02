import {
  CityName,
  CorpIndustryName,
  CorpMaterialName,
  CorpStateName,
  InvestmentOffer,
  NS,
} from '@ns';

import {
  CorpState,
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
  INDUSTRY_MULTIPLIER_MATERIALS,
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
import {
  NetscriptLocator,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';

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
  nsPackage: NetscriptPackage,
  divisionName: string,
  targetResearchPoints: number
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const corpApi = nsLocator.corporation;
  let divisionInfo = await corpApi['getDivision'](divisionName);
  while (divisionInfo.researchPoints < targetResearchPoints) {
    await netscript.corporation.nextUpdate();
    divisionInfo = await corpApi['getDivision'](divisionName);
  }
}

async function waitForMoraleAndEnergy(
  nsPackage: NetscriptPackage,
  divisionName: string,
  targetMorale = 100,
  targetEnergy = 100
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const corpApi = nsLocator.corporation;
  const officesMaxedOut = new Set<CityName>();
  while (officesMaxedOut.size < CITY_NAMES.length) {
    for (const cityName of CITY_NAMES) {
      const officeInfo = await corpApi['getOffice'](divisionName, cityName);
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

async function purchaseMaterial(
  nsPackage: NetscriptPackage,
  divisionName: string,
  cityName: CityName,
  materialName: CorpMaterialName,
  amount: number
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const corpApi = nsLocator.corporation;
  const buyAmount = amount / 10;
  await corpApi['buyMaterial'](divisionName, cityName, materialName, buyAmount);
  await waitForState(netscript, 'PURCHASE');
  await corpApi['buyMaterial'](divisionName, cityName, materialName, 0);
}

async function saleMaterial(
  nsPackage: NetscriptPackage,
  divisionName: string,
  cityName: CityName,
  materialName: CorpMaterialName,
  amount: number
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const corpApi = nsLocator.corporation;
  let materialInfo = await corpApi['getMaterial'](
    divisionName,
    cityName,
    materialName
  );
  const targetAmount = materialInfo.stored - amount;
  while (materialInfo.stored > targetAmount && materialInfo.stored > 0) {
    const sellAmount = materialInfo.stored - targetAmount;
    await corpApi['sellMaterial'](
      divisionName,
      cityName,
      materialName,
      `${sellAmount}`,
      'MP'
    );
    await waitForState(netscript, 'PURCHASE');
    await corpApi['sellMaterial'](
      divisionName,
      cityName,
      materialName,
      '0',
      'MP'
    );

    materialInfo = await corpApi['getMaterial'](
      divisionName,
      cityName,
      materialName
    );
  }
}

async function manageIndustryMaterials(
  nsPackage: NetscriptPackage,
  divisionName: string,
  cities: CityName[],
  industryMaterials: Map<CorpMaterialName, number>
) {
  const nsLocator = nsPackage.locator;

  const corpApi = nsLocator.corporation;
  const divisionInfo = await corpApi['getDivision'](divisionName);
  const industryInfo = await corpApi['getIndustryData'](divisionInfo.type);
  const reservedSpaceRatio = industryInfo.makesMaterials
    ? MATERIAL_DIVISION_RESERVED_SPACE_RATIO
    : PRODUCT_DIVISION_RESERVED_SPACE_RATIO;
  const result = [];
  for (const cityName of cities) {
    const warehouseInfo = await corpApi['getWarehouse'](divisionName, cityName);
    const availableSpace = warehouseInfo.size - warehouseInfo.sizeUsed;

    for (const [materialName, targetAmount] of industryMaterials.entries()) {
      const materialInfo = await corpApi['getMaterial'](
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
          purchaseMaterial(
            nsPackage,
            divisionName,
            cityName,
            materialName,
            amountDifference
          )
        );
      } else if (amountDifference < 0) {
        result.push(
          saleMaterial(
            nsPackage,
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
  nsPackage: NetscriptPackage,
  divisionName: DivisionNames,
  spaceRatio: number
) {
  const nsLocator = nsPackage.locator;

  const corpApi = nsLocator.corporation;
  const divisionInfo = await corpApi['getDivision'](divisionName);
  const warehouseInfo = await corpApi['getWarehouse'](
    divisionName,
    BENCHMARK_OFFICE
  );
  const optimalIndustryMaterials = await addStockedIndustryMaterials(
    nsLocator,
    divisionName,
    await getOptimalIndustryMaterials(
      nsLocator,
      divisionInfo.type,
      (warehouseInfo.size - warehouseInfo.sizeUsed) * spaceRatio
    )
  );
  await Promise.allSettled(
    await manageIndustryMaterials(
      nsPackage,
      divisionName,
      CITY_NAMES,
      optimalIndustryMaterials
    )
  );
}

async function hireEmployees(
  nsLocator: NetscriptLocator,
  divisionName: string,
  cityName: CityName
) {
  while (
    await nsLocator.corporation['hireEmployee'](
      divisionName,
      cityName,
      EmployeePosition.RESEARCH_DEVELOPMENT
    )
  );
}

async function createDivision(
  nsLocator: NetscriptLocator,
  divisionName: string,
  industryType: CorpIndustryName
) {
  const corpApi = nsLocator.corporation;
  const corporationInfo = await corpApi['getCorporation']();

  if (!corporationInfo.divisions.includes(divisionName)) {
    await corpApi['expandIndustry'](industryType, divisionName);
  }
  const divisionInfo = await corpApi['getDivision'](divisionName);

  for (const cityName of CITY_NAMES) {
    if (!divisionInfo.cities.includes(cityName)) {
      await corpApi['expandCity'](divisionName, cityName);
    }
    if (!(await corpApi['hasWarehouse'](divisionName, cityName))) {
      await corpApi['purchaseWarehouse'](divisionName, cityName);
    }
    await hireEmployees(nsLocator, divisionName, cityName);
  }
  return await corpApi['getDivision'](divisionName);
}

async function createFraudDivisions(
  nsLocator: NetscriptLocator,
  totalDivisions: number
) {
  const corpApi = nsLocator.corporation;
  const corporationInfo = await corpApi['getCorporation']();
  for (
    let divisionCounter = 0;
    divisionCounter < totalDivisions;
    divisionCounter++
  ) {
    const divisionName = `${FRAUD_DIVISION_NAME_PREFIX}${divisionCounter
      .toString()
      .padStart(2, '0')}`;
    if (!corporationInfo.divisions.includes(divisionName)) {
      await corpApi['expandIndustry'](IndustryType.RESTAURANT, divisionName);
    }
  }
}

async function buyCorpUpgrade(
  nsLocator: NetscriptLocator,
  upgradeName: UpgradeName,
  targetLevel: number
) {
  const corpApi = nsLocator.corporation;
  for (
    let upgradeCounter = await corpApi['getUpgradeLevel'](upgradeName);
    upgradeCounter < targetLevel;
    upgradeCounter++
  ) {
    await corpApi['levelUpgrade'](upgradeName);
  }
  return await corpApi['getUpgradeLevel'](upgradeName);
}

async function buyAdvert(
  nsLocator: NetscriptLocator,
  divisionName: string,
  targetLevel: number
) {
  const corpApi = nsLocator.corporation;
  for (
    let advertCounter = await corpApi['getHireAdVertCount'](divisionName);
    advertCounter < targetLevel;
    advertCounter++
  ) {
    await corpApi['hireAdVert'](divisionName);
  }
  return await corpApi['getHireAdVertCount'](divisionName);
}

async function buyMaxAdvert(
  nsLocator: NetscriptLocator,
  divisionName: string,
  divisionBudget: number
) {
  const corpApi = nsLocator.corporation;
  const currentLevel = await corpApi['getHireAdVertCount'](divisionName);
  const maxLevel = getMaxAffordableAdvertLevel(currentLevel, divisionBudget);

  await buyAdvert(nsLocator, divisionName, maxLevel);
}

async function improveWarehouse(
  nsLocator: NetscriptLocator,
  divisionName: string,
  cityName: CityName,
  targetLevel: number
) {
  const corpApi = nsLocator.corporation;
  const warehouseInfo = await corpApi['getWarehouse'](divisionName, cityName);
  const buyAmount = targetLevel - warehouseInfo.level;
  if (buyAmount > 0) {
    await corpApi['upgradeWarehouse'](divisionName, cityName, buyAmount);
  }
}

async function upgradeOffices(
  nsLocator: NetscriptLocator,
  divisionName: string,
  cities: CityName[],
  officeSize: number
) {
  const corpApi = nsLocator.corporation;
  for (const cityName of cities) {
    const officeInfo = await corpApi['getOffice'](divisionName, cityName);
    if (officeInfo.size < officeSize) {
      await corpApi['upgradeOfficeSize'](
        divisionName,
        cityName,
        officeSize - officeInfo.size
      );
      await hireEmployees(nsLocator, divisionName, cityName);
    }
  }
}

async function assignEmployees(
  nsLocator: NetscriptLocator,
  divisionName: string,
  officeAssignments: OfficeAssignments[]
) {
  const corpApi = nsLocator.corporation;

  for (const assigments of officeAssignments) {
    for (const employeePosition of Object.values(EmployeePosition)) {
      await corpApi['setAutoJobAssignment'](
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
      await corpApi['setAutoJobAssignment'](
        divisionName,
        assigments.city,
        assignedPosition,
        workerAmount
      );
    }
  }
}

async function setupExport(
  nsLocator: NetscriptLocator,
  sourceDivisionName: string,
  sourceCityName: CityName,
  targetDivisionName: string,
  targetCityName: CityName,
  materialName: MaterialName
) {
  const corpApi = nsLocator.corporation;
  await corpApi['cancelExportMaterial'](
    sourceDivisionName,
    sourceCityName,
    targetDivisionName,
    targetCityName,
    materialName
  );
  await corpApi['exportMaterial'](
    sourceDivisionName,
    sourceCityName,
    targetDivisionName,
    targetCityName,
    materialName,
    EXPORT_FORMULA
  );
}

async function removeAllExports(
  nsLocator: NetscriptLocator,
  sourceDivisionName: string,
  sourceCityName: CityName,
  materialName: MaterialName
) {
  const corpApi = nsLocator.corporation;
  const materialInfo = await corpApi['getMaterial'](
    sourceDivisionName,
    sourceCityName,
    materialName
  );
  for (const exportInfo of materialInfo.exports) {
    await corpApi['cancelExportMaterial'](
      sourceDivisionName,
      sourceCityName,
      exportInfo.division,
      exportInfo.city,
      materialName
    );
  }
}

async function improveProductDivision(
  nsLocator: NetscriptLocator,
  divisionName: string,
  budget: number,
  upgradeAdvert = true
) {
  const corpApi = nsLocator.corporation;
  const divisionInfo = await corpApi['getDivision'](divisionName);
  const budgetRatios =
    divisionInfo.awareness === Number.MAX_VALUE
      ? BUDGET_RATIO_PRODUCT_DIVISION_MAX_ADVERT
      : BUDGET_RATIO_PRODUCT_DIVISION;

  const employeeStatsUpgradeBudget =
    (budget * budgetRatios.employeeStatUpgrades) / 4;
  const currentCreativityUpgradeLevel = await corpApi['getUpgradeLevel'](
    UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS
  );
  const creativityUpgradeInfo =
    CorpUpgradesData[UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS];
  const currentCharismaUpgradeLevel = await corpApi['getUpgradeLevel'](
    UpgradeName.SPEECH_PROCESSOR_IMPLANTS
  );
  const charismaUpgradeInfo =
    CorpUpgradesData[UpgradeName.SPEECH_PROCESSOR_IMPLANTS];
  const currentIntelligenceUpgradeLevel = await corpApi['getUpgradeLevel'](
    UpgradeName.NEURAL_ACCELERATORS
  );
  const intelligenceUpgradeInfo =
    CorpUpgradesData[UpgradeName.NEURAL_ACCELERATORS];
  const currentEfficiencyUpgradeLevel = await corpApi['getUpgradeLevel'](
    UpgradeName.FOCUS_WIRES
  );
  const efficiencyUpgradeInfo = CorpUpgradesData[UpgradeName.FOCUS_WIRES];

  await buyCorpUpgrade(
    nsLocator,
    UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS,
    getMaxAffordableUpgradeLevel(
      creativityUpgradeInfo.basePrice,
      creativityUpgradeInfo.priceMult,
      currentCreativityUpgradeLevel,
      employeeStatsUpgradeBudget
    )
  );
  await buyCorpUpgrade(
    nsLocator,
    UpgradeName.SPEECH_PROCESSOR_IMPLANTS,
    getMaxAffordableUpgradeLevel(
      charismaUpgradeInfo.basePrice,
      charismaUpgradeInfo.priceMult,
      currentCharismaUpgradeLevel,
      employeeStatsUpgradeBudget
    )
  );
  await buyCorpUpgrade(
    nsLocator,
    UpgradeName.NEURAL_ACCELERATORS,
    getMaxAffordableUpgradeLevel(
      intelligenceUpgradeInfo.basePrice,
      intelligenceUpgradeInfo.priceMult,
      currentIntelligenceUpgradeLevel,
      employeeStatsUpgradeBudget
    )
  );
  await buyCorpUpgrade(
    nsLocator,
    UpgradeName.FOCUS_WIRES,
    getMaxAffordableUpgradeLevel(
      efficiencyUpgradeInfo.basePrice,
      efficiencyUpgradeInfo.priceMult,
      currentEfficiencyUpgradeLevel,
      employeeStatsUpgradeBudget
    )
  );

  const salesBotBudget = budget * budgetRatios.salesBot;
  const currentSalesBotLevel = await corpApi['getUpgradeLevel'](
    UpgradeName.ABC_SALES_BOTS
  );
  const salesBotUpgradeInfo = CorpUpgradesData[UpgradeName.ABC_SALES_BOTS];
  await buyCorpUpgrade(
    nsLocator,
    UpgradeName.ABC_SALES_BOTS,
    getMaxAffordableUpgradeLevel(
      salesBotUpgradeInfo.basePrice,
      salesBotUpgradeInfo.priceMult,
      currentSalesBotLevel,
      salesBotBudget
    )
  );

  const projectInsightBudget = budget * budgetRatios.projectInsight;
  const currentProjectInsightLevel = await corpApi['getUpgradeLevel'](
    UpgradeName.PROJECT_INSIGHT
  );
  const projectInsightUpgradeInfo =
    CorpUpgradesData[UpgradeName.PROJECT_INSIGHT];
  await buyCorpUpgrade(
    nsLocator,
    UpgradeName.PROJECT_INSIGHT,
    getMaxAffordableUpgradeLevel(
      projectInsightUpgradeInfo.basePrice,
      projectInsightUpgradeInfo.priceMult,
      currentProjectInsightLevel,
      projectInsightBudget
    )
  );

  const rawProductionBudget = budget * budgetRatios.rawProduction;
  const optimalFactoryStorageUpgrades =
    await getOptimalDivisionFactoryAndStorage(
      nsLocator,
      divisionName,
      rawProductionBudget
    );
  if (optimalFactoryStorageUpgrades) {
    await buyCorpUpgrade(
      nsLocator,
      UpgradeName.SMART_STORAGE,
      optimalFactoryStorageUpgrades.smartStorageLevel
    );
    await buyCorpUpgrade(
      nsLocator,
      UpgradeName.SMART_FACTORIES,
      optimalFactoryStorageUpgrades.smartFactoriesLevel
    );
    for (const cityName of CITY_NAMES) {
      const warehouseInfo = await corpApi['getWarehouse'](
        divisionName,
        cityName
      );
      if (warehouseInfo.level < optimalFactoryStorageUpgrades.warehouseLevel) {
        await corpApi['upgradeWarehouse'](
          divisionName,
          cityName,
          optimalFactoryStorageUpgrades.warehouseLevel - warehouseInfo.level
        );
      }
    }
  }

  if (upgradeAdvert) {
    const advertisingBudget = budget * budgetRatios.wilsonAdvert;
    const optimalAdvertisingUpgrades = await getOptimalAdvert(
      nsLocator,
      divisionName,
      advertisingBudget
    );
    if (optimalAdvertisingUpgrades) {
      await buyCorpUpgrade(
        nsLocator,
        UpgradeName.WILSON_ANALYTICS,
        optimalAdvertisingUpgrades.wilsonLevel
      );
      await buyAdvert(
        nsLocator,
        divisionName,
        optimalAdvertisingUpgrades.advertLevel
      );
    }
  }

  const officeBudget = budget * budgetRatios.office;
  await improveProductDivisionOffices(nsLocator, divisionName, officeBudget);
}

async function improveProductDivisionOffices(
  nsLocator: NetscriptLocator,
  divisionName: string,
  budget: number
) {
  await improveProductMainOffice(nsLocator, divisionName, budget * 0.5);
  await improveProductSupportOffices(nsLocator, divisionName, budget * 0.5);
}

async function improveProductMainOffice(
  nsLocator: NetscriptLocator,
  divisionName: string,
  budget: number
) {
  const corpApi = nsLocator.corporation;
  const officeInfo = await corpApi['getOffice'](
    divisionName,
    DEFAULT_PRODUCT_DESIGN_OFFICE
  );
  const maxOfficeSize = getMaxAffordableOfficeSize(officeInfo.size, budget);
  if (officeInfo.size > maxOfficeSize) {
    return;
  }

  const assignmentRatios = (await corpApi['hasResearched'](
    divisionName,
    ResearchName.MARKET_TA_2
  ))
    ? EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE
    : EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE;
  const employeeAssignments = calculateAssignmentCounts(
    maxOfficeSize,
    assignmentRatios
  );
  const officeAssignments: OfficeAssignments = {
    city: DEFAULT_PRODUCT_DESIGN_OFFICE,
    assignments: employeeAssignments,
  };

  await upgradeOffices(
    nsLocator,
    divisionName,
    [DEFAULT_PRODUCT_DESIGN_OFFICE],
    maxOfficeSize
  );
  await assignEmployees(nsLocator, divisionName, [officeAssignments]);
}

async function improveProductSupportOffices(
  nsLocator: NetscriptLocator,
  divisionName: string,
  budget: number
) {
  const corpApi = nsLocator.corporation;
  const officeBudget = budget / 5;

  for (const cityName of DEFAULT_PRODUCT_RESEARCH_OFFICES) {
    const officeInfo = await corpApi['getOffice'](divisionName, cityName);
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

    await upgradeOffices(nsLocator, divisionName, [cityName], maxOfficeSize);
    await assignEmployees(nsLocator, divisionName, [officeAssignments]);
  }
}

async function improveSupportDivision(
  nsLocator: NetscriptLocator,
  divisionName: string,
  budget: number
) {
  const corpApi = nsLocator.corporation;

  const warehouseBudget =
    (budget * BUDGET_RATIO_SUPPORT_DIVISION.warehouse) / 6;
  const officeBudget = (budget * BUDGET_RATIO_SUPPORT_DIVISION.office) / 6;
  for (const cityName of CITY_NAMES) {
    const warehouseInfo = await corpApi['getWarehouse'](divisionName, cityName);
    const maxWarehouseLevel = getMaxAffordableWarehouseLevel(
      warehouseInfo.level,
      warehouseBudget
    );
    if (maxWarehouseLevel > warehouseInfo.level) {
      await corpApi['upgradeWarehouse'](
        divisionName,
        cityName,
        maxWarehouseLevel - warehouseInfo.level
      );
    }

    let officeInfo = await corpApi['getOffice'](divisionName, cityName);
    const maxOfficeSize = getMaxAffordableOfficeSize(
      officeInfo.size,
      officeBudget
    );
    await upgradeOffices(nsLocator, divisionName, [cityName], maxOfficeSize);

    officeInfo = await corpApi['getOffice'](divisionName, cityName);
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
    await assignEmployees(nsLocator, divisionName, [officeAssignments]);
  }
}

async function buyResearchUpgrades(
  nsLocator: NetscriptLocator,
  divisionName: string,
  researchUpgrades: ResearchName[]
) {
  const corpApi = nsLocator.corporation;
  for (const upgradeName of researchUpgrades) {
    if (!(await corpApi['hasResearched'](divisionName, upgradeName))) {
      await corpApi['research'](divisionName, upgradeName);
    }
  }
}

async function takeBestInvestmentOffer(
  nsPackage: NetscriptPackage,
  decreasesBeforeAccept = 2
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const corpApi = nsLocator.corporation;

  let currentOfferInfo: InvestmentOffer | undefined;
  let previousOfferFunds = 0;
  let decreaseCount = 0;
  while (decreaseCount < decreasesBeforeAccept) {
    await waitForState(netscript, CorpState.START);
    currentOfferInfo = await corpApi['getInvestmentOffer']();

    if (currentOfferInfo.funds <= previousOfferFunds) {
      decreaseCount++;
    } else {
      decreaseCount = 0;
    }
    previousOfferFunds = currentOfferInfo.funds;
  }

  await corpApi['acceptInvestmentOffer']();
  return currentOfferInfo;
}

async function resetMultiplierMaterialPurchases(
  nsPackage: NetscriptPackage,
  divisionName: string,
  cityNames: CityName[]
) {
  const nsLocator = nsPackage.locator;
  const corpApi = nsLocator.corporation;

  const taskPromises = [];
  for (const officeName of cityNames) {
    for (const materialName of INDUSTRY_MULTIPLIER_MATERIALS) {
      taskPromises.push(
        corpApi['buyMaterial'](divisionName, officeName, materialName, 0)
      );
      taskPromises.push(
        corpApi['sellMaterial'](
          divisionName,
          officeName,
          materialName,
          '0',
          'MP'
        )
      );
    }
  }
  await Promise.all(taskPromises);
}

export {
  DEFAULT_PRODUCT_DESIGN_OFFICE,
  DEFAULT_PRODUCT_RESEARCH_OFFICES,
  EMPLOYEE_RATIO_PRODUCT_MAIN_OFFICE,
  waitForState,
  waitForResearch,
  waitForMoraleAndEnergy,
  purchaseMaterial,
  saleMaterial,
  manageIndustryMaterials,
  buyIndustryMaterials,
  createDivision,
  createFraudDivisions,
  buyCorpUpgrade,
  buyAdvert,
  buyMaxAdvert,
  improveWarehouse,
  upgradeOffices,
  assignEmployees,
  setupExport,
  removeAllExports,
  improveProductDivision,
  improveSupportDivision,
  buyResearchUpgrades,
  takeBestInvestmentOffer,
  resetMultiplierMaterialPurchases,
};
