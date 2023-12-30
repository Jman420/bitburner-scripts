import {
  CityName,
  CorpIndustryName,
  CorpMaterialName,
  Material,
  NS,
  Product,
} from '@ns';
import {Ceres} from '/scripts/libs/Ceres';

import {
  EmployeePosition,
  ResearchName,
  UnlockName,
  UpgradeName,
} from '/scripts/data/corporation-enums';
import {CorpUpgradesData} from '/scripts/data/corporation-upgrades-data';
import {CorpResearchesData} from '/scripts/data/corporation-researches-data';

import {
  BENCHMARK_OFFICE,
  INDUSTRY_MULTIPLIER_MATERIALS,
} from '/scripts/workflows/corporation-shared';
import {
  getAdvertCost,
  getAdvertisingFactor,
  getBusinessFactor,
  getDivisionProductionMultiplier,
  getMaxAffordableAdvertLevel,
  getMaxAffordableUpgradeLevel,
  getMaxAffordableWarehouseLevel,
  getPricingBalanceFactor,
  getUpgradeCost,
  getWarehouseCost,
  getWarehouseSize,
} from '/scripts/workflows/corporation-formulas';

interface OptimalDivisionFactoryAndStorageInfo {
  production: number;
  cost: number;
  warehouseSize: number;
  smartStorageLevel: number;
  warehouseLevel: number;
  smartFactoriesLevel: number;
}

interface OptimalDivisionWilsonAndAdvertInfo {
  wilsonLevel: number;
  advertLevel: number;
  advertisingFactor: number;
  cost: number;
}

function calculateOptimalIndustryMaterials(
  industryFactors: number[],
  materialSizes: number[],
  storageSize: number,
  wholeNumResults: boolean
): number[] {
  const weightsSum = industryFactors.reduce(
    (value, aggregate) => value + aggregate,
    0
  );
  const sizesSum = materialSizes.reduce(
    (value, aggregate) => value + aggregate,
    0
  );

  const results = new Array<number>();
  for (
    let entryCounter = 0;
    entryCounter < materialSizes.length;
    entryCounter++
  ) {
    const materialSize = materialSizes[entryCounter];
    const divisionWeight = industryFactors[entryCounter];
    const materialAmount =
      (storageSize -
        500 *
          ((materialSize / divisionWeight) * (weightsSum - divisionWeight) -
            (sizesSum - materialSize))) /
      (weightsSum / divisionWeight) /
      materialSize;

    if (divisionWeight <= 0 || materialAmount < 0) {
      return calculateOptimalIndustryMaterials(
        industryFactors.toSpliced(entryCounter, 1),
        materialSizes.toSpliced(entryCounter, 1),
        storageSize,
        wholeNumResults
      ).toSpliced(entryCounter, 0, 0);
    } else {
      results.push(
        wholeNumResults ? Math.round(materialAmount) : materialAmount
      );
    }
  }

  return results;
}

function getOptimalIndustryMaterials(
  netscript: NS,
  industryType: CorpIndustryName,
  storageSize: number,
  wholeNumResults = true
) {
  const corpApi = netscript.corporation;
  const industryData = corpApi.getIndustryData(industryType);
  const industryFactors = [
    industryData.hardwareFactor ?? 0,
    industryData.aiCoreFactor ?? 0,
    industryData.robotFactor ?? 0,
    industryData.realEstateFactor ?? 0,
  ];
  const materialSizes = INDUSTRY_MULTIPLIER_MATERIALS.map(
    materialName => corpApi.getMaterialData(materialName).size
  );

  const results = new Map<CorpMaterialName, number>();
  const calcResults = calculateOptimalIndustryMaterials(
    industryFactors,
    materialSizes,
    storageSize,
    wholeNumResults
  );
  calcResults.forEach((value, index) =>
    results.set(INDUSTRY_MULTIPLIER_MATERIALS[index], value)
  );
  return results;
}

function getOptimalDivisionFactoryAndStorage(
  netscript: NS,
  divisionName: string,
  budget: number,
  industryMaterialsRatio = 0.8
) {
  const corpApi = netscript.corporation;
  const divisionInfo = corpApi.getDivision(divisionName);
  const industryInfo = corpApi.getIndustryData(divisionInfo.type);
  const warehouseInfo = corpApi.getWarehouse(divisionName, BENCHMARK_OFFICE);

  const currentSmartStorageLevel = corpApi.getUpgradeLevel(
    UpgradeName.SMART_STORAGE
  );
  const currentSmartFactoryLevel = corpApi.getUpgradeLevel(
    UpgradeName.SMART_FACTORIES
  );
  const currentWarehouseLevel = warehouseInfo.level;
  const researchStorageMultiplier = corpApi.hasResearched(
    divisionName,
    ResearchName.DRONES_TRANSPORT
  )
    ? CorpResearchesData[ResearchName.DRONES_TRANSPORT].storageMult
    : 1;

  const smartStorageUpgradeInfo = CorpUpgradesData[UpgradeName.SMART_STORAGE];
  const smartFactoriesUpgradeInfo =
    CorpUpgradesData[UpgradeName.SMART_FACTORIES];

  const maxSmartStorageLevel = getMaxAffordableUpgradeLevel(
    smartStorageUpgradeInfo.basePrice,
    smartStorageUpgradeInfo.priceMult,
    currentSmartStorageLevel,
    budget
  );
  const minSmartStorageLevel =
    maxSmartStorageLevel - currentSmartStorageLevel > 1000
      ? maxSmartStorageLevel - 1000
      : currentSmartStorageLevel;
  const maxWarehouseLevel = getMaxAffordableWarehouseLevel(
    currentWarehouseLevel,
    budget / 6
  );
  const minWarehouseLevel =
    maxWarehouseLevel - currentWarehouseLevel > 1000
      ? maxWarehouseLevel - 1000
      : currentWarehouseLevel;

  const comparator = (
    value1: OptimalDivisionFactoryAndStorageInfo,
    value2: OptimalDivisionFactoryAndStorageInfo
  ) => {
    if (value1.production !== value2.production) {
      return value1.production - value2.production;
    }
    return value2.cost - value1.cost;
  };

  let optimalInfo: OptimalDivisionFactoryAndStorageInfo | undefined = undefined;
  for (
    let smartStorageLevel = minSmartStorageLevel;
    smartStorageLevel <= maxSmartStorageLevel;
    smartStorageLevel++
  ) {
    const smartStorageCost = getUpgradeCost(
      smartStorageUpgradeInfo.basePrice,
      smartStorageUpgradeInfo.priceMult,
      currentSmartStorageLevel,
      smartStorageLevel
    );
    for (
      let warehouseLevel = minWarehouseLevel;
      warehouseLevel <= maxWarehouseLevel;
      warehouseLevel++
    ) {
      const warehouseCost =
        getWarehouseCost(currentWarehouseLevel, warehouseLevel) * 6;
      if (smartStorageCost + warehouseCost > budget) {
        break;
      }

      const warehouseSize = getWarehouseSize(
        smartStorageLevel,
        warehouseLevel,
        researchStorageMultiplier
      );
      const industryMaterials = getOptimalIndustryMaterials(
        netscript,
        divisionInfo.type,
        warehouseSize * industryMaterialsRatio
      );
      const materialsMultiplier = getDivisionProductionMultiplier(
        industryInfo,
        industryMaterials
      );

      const smartFactoriesBudget = budget - (smartStorageCost + warehouseCost);
      const smartFactoriesLevel = getMaxAffordableUpgradeLevel(
        smartFactoriesUpgradeInfo.basePrice,
        smartFactoriesUpgradeInfo.priceMult,
        currentSmartFactoryLevel,
        smartFactoriesBudget
      );
      const smartFactoriesCost = getUpgradeCost(
        smartFactoriesUpgradeInfo.basePrice,
        smartFactoriesUpgradeInfo.priceMult,
        currentSmartFactoryLevel,
        smartFactoriesLevel
      );
      const smartFactoriesMultiplier =
        1 + smartFactoriesUpgradeInfo.benefit * smartFactoriesLevel;

      const production = materialsMultiplier * smartFactoriesMultiplier;
      const totalCost = smartStorageCost + warehouseCost + smartFactoriesCost;
      const eligibleEntry: OptimalDivisionFactoryAndStorageInfo = {
        production: production,
        cost: totalCost,
        warehouseSize: warehouseSize,
        smartStorageLevel: smartStorageLevel,
        warehouseLevel: warehouseLevel,
        smartFactoriesLevel: smartFactoriesLevel,
      };

      if (!optimalInfo || comparator(eligibleEntry, optimalInfo) > 0) {
        optimalInfo = eligibleEntry;
      }
    }
  }

  return optimalInfo;
}

function getOptimalAdvert(netscript: NS, divisionName: string, budget: number) {
  const corpApi = netscript.corporation;
  const divisionInfo = corpApi.getDivision(divisionName);
  const industryInfo = corpApi.getIndustryData(divisionInfo.type);

  const currentWilsonLevel = corpApi.getUpgradeLevel(
    UpgradeName.WILSON_ANALYTICS
  );
  const wilsonUpgradeInfo = CorpUpgradesData[UpgradeName.WILSON_ANALYTICS];
  const maxWilsonLevel = getMaxAffordableUpgradeLevel(
    wilsonUpgradeInfo.basePrice,
    wilsonUpgradeInfo.priceMult,
    currentWilsonLevel,
    budget
  );
  const currentAdvertLevel = corpApi.getHireAdVertCount(divisionName);
  const maxAdvertLevel = getMaxAffordableAdvertLevel(
    currentAdvertLevel,
    budget
  );

  const comparator = (
    value1: OptimalDivisionWilsonAndAdvertInfo,
    value2: OptimalDivisionWilsonAndAdvertInfo
  ) => {
    if (value1.advertisingFactor !== value2.advertisingFactor) {
      return value1.advertisingFactor - value2.advertisingFactor;
    }
    return value2.cost - value1.cost;
  };

  let optimalInfo: OptimalDivisionWilsonAndAdvertInfo | undefined = undefined;
  for (
    let wilsonLevel = currentWilsonLevel;
    wilsonLevel <= maxWilsonLevel;
    wilsonLevel++
  ) {
    const wilsonCost = getUpgradeCost(
      wilsonUpgradeInfo.basePrice,
      wilsonUpgradeInfo.priceMult,
      currentWilsonLevel,
      wilsonLevel
    );
    let previousAwareness = 0;
    let previousPopularity = 0;

    for (
      let advertLevel = currentAdvertLevel;
      advertLevel <= maxAdvertLevel;
      advertLevel++
    ) {
      const advertCost = getAdvertCost(currentAdvertLevel, advertLevel);
      const totalCost = wilsonCost + advertCost;
      if (totalCost > budget) {
        break;
      }

      const advertisingMultiplier = 1 + wilsonUpgradeInfo.benefit * wilsonLevel;
      const awareness = Math.min(
        (previousAwareness + 3 * advertisingMultiplier) *
          (1.005 * advertisingMultiplier),
        Number.MAX_VALUE
      );
      const popularity = Math.min(
        (previousPopularity + advertisingMultiplier) *
          ((1 + 2 / 200) * advertisingMultiplier),
        Number.MAX_VALUE
      );
      const advertisingFactor = getAdvertisingFactor(
        awareness,
        popularity,
        industryInfo.advertisingFactor ?? 0
      );

      const eligibleEntry: OptimalDivisionWilsonAndAdvertInfo = {
        wilsonLevel: wilsonLevel,
        advertLevel: advertLevel,
        advertisingFactor: advertisingFactor,
        cost: totalCost,
      };
      if (!optimalInfo || comparator(eligibleEntry, optimalInfo) > 0) {
        optimalInfo = eligibleEntry;
      }

      previousAwareness = awareness;
      previousPopularity = popularity;
    }
  }

  return optimalInfo;
}

async function getOptimalProductMarkup(
  netscript: NS,
  divisionName: string,
  cityName: CityName,
  productInfo: Product
) {
  const corpApi = netscript.corporation;
  const divisionInfo = corpApi.getDivision(divisionName);
  const industryInfo = corpApi.getIndustryData(divisionInfo.type);
  const officeInfo = corpApi.getOffice(divisionName, cityName);
  const employeeProductionByJob = officeInfo.employeeProductionByJob;

  const designInvestmentFactor =
    1 + Math.pow(productInfo.designInvestment, 0.1) / 100;
  const researchPointsFactor =
    1 +
    Math.pow(divisionInfo.researchPoints, industryInfo.scienceFactor ?? 0) /
      800;
  const productFactor = designInvestmentFactor * researchPointsFactor;

  const qualityFactorCalc = ([
    engineerProduction,
    managementProduction,
    researchProduction,
    operationsProduction,
    businessProduction,
  ]: number[]) =>
    productFactor *
      getPricingBalanceFactor(
        operationsProduction,
        engineerProduction,
        businessProduction,
        managementProduction,
        researchProduction
      ) *
      (0.1 * engineerProduction +
        0.05 * managementProduction +
        0.05 * researchProduction +
        0.02 * operationsProduction +
        0.02 * businessProduction) -
    productInfo.stats.quality;
  const performanceFactorCalc = ([
    engineerProduction,
    managementProduction,
    researchProduction,
    operationsProduction,
    businessProduction,
  ]: number[]) =>
    productFactor *
      getPricingBalanceFactor(
        operationsProduction,
        engineerProduction,
        businessProduction,
        managementProduction,
        researchProduction
      ) *
      (0.15 * engineerProduction +
        0.02 * managementProduction +
        0.02 * researchProduction +
        0.02 * operationsProduction +
        0.02 * businessProduction) -
    productInfo.stats.performance;
  const durabilityFactorCalc = ([
    engineerProduction,
    managementProduction,
    researchProduction,
    operationsProduction,
    businessProduction,
  ]: number[]) =>
    productFactor *
      getPricingBalanceFactor(
        operationsProduction,
        engineerProduction,
        businessProduction,
        managementProduction,
        researchProduction
      ) *
      (0.05 * engineerProduction +
        0.02 * managementProduction +
        0.08 * researchProduction +
        0.05 * operationsProduction +
        0.05 * businessProduction) -
    productInfo.stats.durability;
  const reliabilityFactorCalc = ([
    engineerProduction,
    managementProduction,
    researchProduction,
    operationsProduction,
    businessProduction,
  ]: number[]) =>
    productFactor *
      getPricingBalanceFactor(
        operationsProduction,
        engineerProduction,
        businessProduction,
        managementProduction,
        researchProduction
      ) *
      (0.02 * engineerProduction +
        0.08 * managementProduction +
        0.02 * researchProduction +
        0.05 * operationsProduction +
        0.08 * businessProduction) -
    productInfo.stats.reliability;
  const aestheticsFactorCalc = ([
    engineerProduction,
    managementProduction,
    researchProduction,
    operationsProduction,
    businessProduction,
  ]: number[]) =>
    productFactor *
      getPricingBalanceFactor(
        operationsProduction,
        engineerProduction,
        businessProduction,
        managementProduction,
        researchProduction
      ) *
      (0.08 * managementProduction +
        0.05 * researchProduction +
        0.02 * operationsProduction +
        0.1 * businessProduction) -
    productInfo.stats.aesthetics;

  const ceresSolver = new Ceres();
  await ceresSolver.promise;
  ceresSolver.add_function(qualityFactorCalc);
  ceresSolver.add_function(performanceFactorCalc);
  ceresSolver.add_function(durabilityFactorCalc);
  ceresSolver.add_function(reliabilityFactorCalc);
  ceresSolver.add_function(aestheticsFactorCalc);

  const solverResult = ceresSolver.solve([
    employeeProductionByJob.Engineer,
    employeeProductionByJob.Management,
    employeeProductionByJob['Research & Development'],
    employeeProductionByJob.Operations,
    employeeProductionByJob.Business,
  ]);
  ceresSolver.remove();
  if (!solverResult || !solverResult.success) {
    throw new Error(
      `Failed to calculate Product Markup.  Unable to determine hidden product stats : ${divisionName} - ${cityName} - ${productInfo.name}`
    );
  }

  const totalJobFactors =
    solverResult.x[0] +
    solverResult.x[1] +
    solverResult.x[2] +
    solverResult.x[3] +
    solverResult.x[4];
  const managementRatio = solverResult.x[1] / totalJobFactors;
  const businessRatio = solverResult.x[4] / totalJobFactors;

  const advertisingInvestmentFactor =
    1 + Math.pow(productInfo.advertisingInvestment, 0.1) / 100;
  const businessManagementRatio = Math.max(
    businessRatio + managementRatio,
    1 / totalJobFactors
  );
  const productQualityFactor = Math.pow(
    productInfo.stats.quality + 0.001,
    0.65
  );
  return (
    100 /
    (advertisingInvestmentFactor *
      productQualityFactor *
      businessManagementRatio)
  );
}

function isProduct(item: Material | Product): item is Product {
  return 'rating' in item;
}
function getOptimalSellingPrice(
  netscript: NS,
  divisionName: string,
  cityName: CityName,
  itemInfo: Material | Product,
  productMarkup?: number
) {
  const corpApi = netscript.corporation;
  if (
    !corpApi.hasUnlock(UnlockName.MARKET_DATA_COMPETITION) ||
    !corpApi.hasUnlock(UnlockName.MARKET_RESEARCH_DEMAND)
  ) {
    return undefined;
  }

  const targetSalesVolume = itemInfo.stored / 10;
  if (targetSalesVolume < 1e-5) {
    return undefined;
  }

  const officeInfo = corpApi.getOffice(divisionName, cityName);
  let markupLimit: number;
  let itemMultiplier: number;
  let marketPrice: number;
  if (isProduct(itemInfo)) {
    if (!productMarkup) {
      return undefined;
    }

    markupLimit = Math.max(itemInfo.effectiveRating, 0.001) / productMarkup;
    itemMultiplier = 0.5 * Math.pow(itemInfo.effectiveRating, 0.65);
    marketPrice = itemInfo.productionCost;
  } else {
    markupLimit =
      itemInfo.quality / corpApi.getMaterialData(itemInfo.name).baseMarkup;
    itemMultiplier = itemInfo.quality + 0.001;
    marketPrice = itemInfo.marketPrice;
  }

  const divisionInfo = corpApi.getDivision(divisionName);
  const industryInfo = corpApi.getIndustryData(divisionInfo.type);
  const businessFactor = getBusinessFactor(
    officeInfo.employeeProductionByJob[EmployeePosition.BUSINESS]
  );
  const advertisingFactor = getAdvertisingFactor(
    divisionInfo.awareness,
    divisionInfo.popularity,
    industryInfo.advertisingFactor!
  );

  const itemDemand = itemInfo.demand ?? 0;
  const itemCompetition = itemInfo.competition ?? 0;
  const marketFactor = Math.max(
    0.1,
    (itemDemand * (100 - itemCompetition)) / 100
  );

  const salesBotsLevel = corpApi.getUpgradeLevel(UpgradeName.ABC_SALES_BOTS);
  const salesBotsUpgradeInfo = CorpUpgradesData[UpgradeName.ABC_SALES_BOTS];
  const salesBotUpgradeBenefit =
    salesBotsLevel * salesBotsUpgradeInfo.benefit + 1;

  const researchSalesMulti = 1;
  const salesMultipliers =
    itemMultiplier *
    businessFactor *
    advertisingFactor *
    marketFactor *
    salesBotUpgradeBenefit *
    researchSalesMulti;

  const optimalPrice =
    markupLimit / Math.sqrt(targetSalesVolume / salesMultipliers) + marketPrice;
  return optimalPrice;
}

export {
  getOptimalIndustryMaterials,
  getOptimalDivisionFactoryAndStorage,
  getOptimalAdvert,
  getOptimalProductMarkup,
  getOptimalSellingPrice,
};
