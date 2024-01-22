import {CityName, CorpIndustryData, CorpMaterialName} from '@ns';

import {
  EmployeePosition,
  MaterialName,
  ResearchName,
  UpgradeName,
} from '/scripts/data/corporation-enums';
import {CorpUpgradesData} from '/scripts/data/corporation-upgrades-data';
import {CorpResearchesData} from '/scripts/data/corporation-researches-data';

import {CITY_NAMES} from '/scripts/common/shared';
import {
  BENCHMARK_OFFICE,
  INDUSTRY_MULTIPLIER_MATERIALS,
  ResearchUpgrade,
} from '/scripts/workflows/corporation-shared';
import {NetscriptLocator} from '/scripts/netscript-services/netscript-locator';

interface OfficeAssignments {
  city: CityName;
  assignments: Map<EmployeePosition, number>;
}

const WAREHOUSE_UPGRADE_BASE_PRICE = 1e9;
const OFFICE_UPGRADE_BASE_PRICE = 4e9;
const OFFICE_UPGRADE_PRICE_MULTIPLIER = 1.09;
const ADVERT_BASE_PRICE = 1e9;
const ADVERT_PRICE_MULTIPLIER = 1.06;

const RESEARCH_SAFETY_MULTIPLIER_STATS = 5;
const RESEARCH_SAFETY_MULTIPLIER_PRODUCTION = 10;
const RESEARCH_PRIORITIES_SUPPORT_DIVISION: ResearchUpgrade[] = [
  {name: ResearchName.HI_TECH_RND_LABORATORY, safetyCostMultiplier: 1},
  {name: ResearchName.AUTO_DRUG, safetyCostMultiplier: 13.5},
  {
    name: ResearchName.GO_JUICE,
    safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_STATS,
  },
  {
    name: ResearchName.OVERCLOCK,
    safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_STATS,
  },
  {
    name: ResearchName.STIMU,
    safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_STATS,
  },
  {
    name: ResearchName.CPH4_INJECT,
    safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_STATS,
  },

  {
    name: ResearchName.SELF_CORRECTING_ASSEMBLERS,
    safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_PRODUCTION,
  },
  {name: ResearchName.DRONES, safetyCostMultiplier: 50},
  {
    name: ResearchName.DRONES_ASSEMBLY,
    safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_PRODUCTION,
  },
  {
    name: ResearchName.DRONES_TRANSPORT,
    safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_PRODUCTION,
  },
];
const RESEARCH_PRIORITIES_PRODUCT_DIVISION: ResearchUpgrade[] = [
  ...RESEARCH_PRIORITIES_SUPPORT_DIVISION,
  {
    name: ResearchName.UPGRADE_FULCRUM,
    safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_PRODUCTION,
  },
  // {name: ResearchName.UPGRADE_CAPACITY_1, safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_PRODUCTION},
  // {name: ResearchName.UPGRADE_CAPACITY_2, safetyCostMultiplier: RESEARCH_SAFETY_MULTIPLIER_PRODUCTION},
];

function getUpgradeCost(
  basePrice: number,
  priceMultiplier: number,
  fromLevel: number,
  toLevel: number
): number {
  return (
    basePrice *
    ((Math.pow(priceMultiplier, toLevel) -
      Math.pow(priceMultiplier, fromLevel)) /
      (priceMultiplier - 1))
  );
}

function getAdvertCost(fromLevel: number, toLevel: number) {
  return getUpgradeCost(
    ADVERT_BASE_PRICE,
    ADVERT_PRICE_MULTIPLIER,
    fromLevel,
    toLevel
  );
}

function getWarehouseCost(fromLevel: number, toLevel: number) {
  return (
    WAREHOUSE_UPGRADE_BASE_PRICE *
    ((Math.pow(1.07, toLevel + 1) - Math.pow(1.07, fromLevel + 1)) / 0.07)
  );
}

function getMaxAffordableUpgradeLevel(
  basePrice: number,
  priceMultiplier: number,
  fromLevel: number,
  budget: number
) {
  return Math.floor(
    Math.log(
      (budget * (priceMultiplier - 1)) / basePrice +
        Math.pow(priceMultiplier, fromLevel)
    ) / Math.log(priceMultiplier)
  );
}

function getMaxAffordableAdvertLevel(fromLevel: number, budget: number) {
  return getMaxAffordableUpgradeLevel(
    ADVERT_BASE_PRICE,
    ADVERT_PRICE_MULTIPLIER,
    fromLevel,
    budget
  );
}

function getMaxAffordableOfficeSize(fromSize: number, budget: number) {
  return (
    getMaxAffordableUpgradeLevel(
      OFFICE_UPGRADE_BASE_PRICE,
      OFFICE_UPGRADE_PRICE_MULTIPLIER,
      Math.ceil(fromSize / 3),
      budget
    ) * 3
  );
}

function getMaxAffordableWarehouseLevel(fromLevel: number, budget: number) {
  return Math.floor(
    Math.log(
      (budget * 0.07) / WAREHOUSE_UPGRADE_BASE_PRICE +
        Math.pow(1.07, fromLevel + 1)
    ) /
      Math.log(1.07) -
      1
  );
}

function getWarehouseSize(
  smartStorageLevel: number,
  warehouseLevel: number,
  researchStorageMultiplier: number
): number {
  return (
    warehouseLevel *
    100 *
    (1 +
      CorpUpgradesData[UpgradeName.SMART_STORAGE].benefit * smartStorageLevel) *
    researchStorageMultiplier
  );
}

function getAdvertisingFactor(
  awareness: number,
  popularity: number,
  industryAdvertisingFactor: number
) {
  const awarenessFactor = Math.pow(awareness + 1, industryAdvertisingFactor);
  const popularityFactor = Math.pow(popularity + 1, industryAdvertisingFactor);
  const ratioFactor =
    awareness <= 0 ? 0.01 : Math.max((popularity + 0.001) / awareness, 0.01);
  const advertisingFactor = Math.pow(
    awarenessFactor * popularityFactor * ratioFactor,
    0.85
  );
  return advertisingFactor;
}

async function getDivisionProductLimit(
  nsLocator: NetscriptLocator,
  divisionName: string
) {
  const corpApi = nsLocator.corporation;
  if (
    await corpApi['hasResearched'](
      divisionName,
      ResearchName.UPGRADE_CAPACITY_2
    )
  ) {
    return 5;
  }
  if (
    await corpApi['hasResearched'](
      divisionName,
      ResearchName.UPGRADE_CAPACITY_1
    )
  ) {
    return 4;
  }
  return 3;
}

function getDivisionProductionMultiplier(
  industryData: CorpIndustryData,
  boostMaterials: Map<CorpMaterialName, number>
) {
  const hardwareAmount = boostMaterials.get(MaterialName.HARDWARE) ?? 0;
  const robotsAmount = boostMaterials.get(MaterialName.ROBOTS) ?? 0;
  const aiCoresAmount = boostMaterials.get(MaterialName.AI_CORES) ?? 0;
  const realEstateAmount = boostMaterials.get(MaterialName.REAL_ESTATE) ?? 0;

  const cityMultiplier =
    Math.pow(0.002 * hardwareAmount + 1, industryData.hardwareFactor ?? 0) *
    Math.pow(0.002 * robotsAmount + 1, industryData.robotFactor ?? 0) *
    Math.pow(0.002 * aiCoresAmount + 1, industryData.aiCoreFactor ?? 0) *
    Math.pow(0.002 * realEstateAmount + 1, industryData.realEstateFactor ?? 0);

  return Math.max(Math.pow(cityMultiplier, 0.73), 1) * 6;
}

async function getOfficeProductionMultiplier(
  nsLocator: NetscriptLocator,
  divisionName: string,
  cityName: CityName
) {
  const corpApi = nsLocator.corporation;
  const officeInfo = await corpApi['getOffice'](divisionName, cityName);
  const operationsProd = officeInfo.employeeProductionByJob.Operations;
  const engineerProd = officeInfo.employeeProductionByJob.Engineer;
  const managementProd = officeInfo.employeeProductionByJob.Management;
  const employeeProd = operationsProd + engineerProd + managementProd;
  if (employeeProd <= 0) {
    return 0;
  }

  const managementFactor = managementProd / (1.2 * employeeProd) + 1;
  const productionMultiplier =
    (Math.pow(operationsProd, 0.4) + Math.pow(engineerProd, 0.3)) *
    managementFactor;

  const balancingMultiplier = 0.05;
  let officeProductionMultiplier = productionMultiplier * balancingMultiplier;
  const divisionInfo = await corpApi['getDivision'](divisionName);
  if (divisionInfo.makesProducts) {
    officeProductionMultiplier *= 0.5;
  }
  return officeProductionMultiplier;
}

async function getOfficeMaxProduction(
  nsLocator: NetscriptLocator,
  divisionName: string,
  cityName: CityName
) {
  const corpApi = nsLocator.corporation;
  const divisionInfo = await corpApi['getDivision'](divisionName);

  const smartFactoriesUpgradeInfo =
    CorpUpgradesData[UpgradeName.SMART_FACTORIES];
  const dronesAssemblyResearchInfo =
    CorpResearchesData[ResearchName.DRONES_ASSEMBLY];
  const selfCorrectingAssemblersResearchInfo =
    CorpResearchesData[ResearchName.SELF_CORRECTING_ASSEMBLERS];
  const fulcrumUpgradeResearchInfo =
    CorpResearchesData[ResearchName.UPGRADE_FULCRUM];

  const officeMultiplier = await getOfficeProductionMultiplier(
    nsLocator,
    divisionName,
    cityName
  );
  const divisionProductionMultiplier = divisionInfo.productionMult;
  const smartFactoriesLevel = await corpApi['getUpgradeLevel'](
    smartFactoriesUpgradeInfo.name
  );
  const upgradesMultiplier =
    1 + smartFactoriesLevel * smartFactoriesUpgradeInfo.benefit;
  const hasDroneAssembly = await corpApi['hasResearched'](
    divisionName,
    ResearchName.DRONES_ASSEMBLY
  );
  const hasAssemblers = await corpApi['hasResearched'](
    divisionName,
    ResearchName.SELF_CORRECTING_ASSEMBLERS
  );
  const hasFulcrum = await corpApi['hasResearched'](
    divisionName,
    ResearchName.UPGRADE_FULCRUM
  );
  const researchMultiplier =
    (hasDroneAssembly ? dronesAssemblyResearchInfo.productionMult : 1) *
    (hasAssemblers ? selfCorrectingAssemblersResearchInfo.productionMult : 1) *
    (divisionInfo.makesProducts && hasFulcrum
      ? fulcrumUpgradeResearchInfo.productProductionMult
      : 1);

  return (
    officeMultiplier *
    divisionProductionMultiplier *
    upgradesMultiplier *
    researchMultiplier
  );
}

async function getOfficeLimitedProduction(
  nsLocator: NetscriptLocator,
  divisionName: string,
  cityName: CityName,
  productSize?: number
) {
  const corpApi = nsLocator.corporation;
  const divisionInfo = await corpApi['getDivision'](divisionName);
  const industryInfo = await corpApi['getIndustryData'](divisionInfo.type);

  let outputUnitStorageSpaceChange = productSize ? productSize : 0;
  if (!productSize) {
    for (const materialName of industryInfo.producedMaterials ?? []) {
      const materialInfo = await corpApi['getMaterialData'](materialName);
      outputUnitStorageSpaceChange += materialInfo.size;
    }
  }

  for (const [materialName, requiredCoefficient] of Object.entries(
    industryInfo.requiredMaterials
  )) {
    const materialInfo = await corpApi['getMaterialData'](
      materialName as CorpMaterialName
    );
    outputUnitStorageSpaceChange -= materialInfo.size * requiredCoefficient;
  }

  let limitedProduction =
    (await getOfficeMaxProduction(nsLocator, divisionName, cityName)) * 10;
  if (outputUnitStorageSpaceChange > 0) {
    const warehouseInfo = await corpApi['getWarehouse'](divisionName, cityName);
    const adjustedProduction =
      (warehouseInfo.size - warehouseInfo.sizeUsed) /
      outputUnitStorageSpaceChange;
    limitedProduction = Math.min(adjustedProduction, limitedProduction);
  }

  return Math.max(0, limitedProduction);
}

function generateOfficeAssignments(
  employeeAssignments: Map<EmployeePosition, number>,
  cities?: CityName[]
) {
  if (!cities || cities.length < 1) {
    cities = CITY_NAMES;
  }

  const result = [];
  for (const cityName of cities) {
    result.push({city: cityName, assignments: employeeAssignments});
  }
  return result;
}

function calculateAssignmentCounts(
  officeSize: number,
  assignmentRatios: Map<EmployeePosition, number>
) {
  let adjustedOfficeSize = officeSize;
  for (const ratioValue of assignmentRatios.values()) {
    if (ratioValue >= 1) {
      adjustedOfficeSize -= ratioValue;
    }
  }

  const result = new Map<EmployeePosition, number>();
  let favoredPosition = EmployeePosition.RESEARCH_DEVELOPMENT;
  let favoredRatio = -1;
  let neglectedPosition = EmployeePosition.INTERN;
  let neglectedRatio = Number.MAX_SAFE_INTEGER;
  let totalAssignedCount = 0;
  for (const [positionName, ratioValue] of assignmentRatios.entries()) {
    if (ratioValue >= 1) {
      continue;
    }

    if (favoredRatio < ratioValue) {
      favoredRatio = ratioValue;
      favoredPosition = positionName;
    }
    if (neglectedRatio > ratioValue) {
      neglectedRatio = ratioValue;
      neglectedPosition = positionName;
    }

    const employeeCount =
      ratioValue < 1 ? Math.floor(adjustedOfficeSize * ratioValue) : ratioValue;
    result.set(positionName, employeeCount);
    totalAssignedCount += employeeCount;
  }

  if (totalAssignedCount < adjustedOfficeSize) {
    const favoredPositionCount = result.get(favoredPosition) ?? 0;
    result.set(
      favoredPosition,
      favoredPositionCount + (adjustedOfficeSize - totalAssignedCount)
    );
  } else if (totalAssignedCount > adjustedOfficeSize) {
    const neglectedPositionCount = result.get(neglectedPosition) ?? 0;
    result.set(
      neglectedPosition,
      neglectedPositionCount - (adjustedOfficeSize - totalAssignedCount)
    );
  }
  return result;
}

function getBusinessFactor(businessProduction: number) {
  businessProduction += 1;
  return Math.pow(businessProduction, 0.26) + businessProduction / 10e3;
}

function getPricingBalanceFactor(
  operationsProduction: number,
  engineerProduction: number,
  businessProduction: number,
  managementProduction: number,
  researchProduction: number
) {
  const totalCreationJobFactors =
    engineerProduction +
    managementProduction +
    researchProduction +
    operationsProduction +
    businessProduction;
  const engineerRatio = engineerProduction / totalCreationJobFactors;
  const managementRatio = managementProduction / totalCreationJobFactors;
  const researchRatio = researchProduction / totalCreationJobFactors;
  const operationsRatio = operationsProduction / totalCreationJobFactors;
  const businessRatio = businessProduction / totalCreationJobFactors;
  return (
    1.2 * engineerRatio +
    0.9 * managementRatio +
    1.3 * researchRatio +
    1.5 * operationsRatio +
    businessRatio
  );
}

async function addStockedIndustryMaterials(
  nsLocator: NetscriptLocator,
  divisionName: string,
  optimalIndustryMaterials: Map<CorpMaterialName, number>
) {
  const corpApi = nsLocator.corporation;
  const result = new Map<CorpMaterialName, number>();
  for (const materialName of INDUSTRY_MULTIPLIER_MATERIALS) {
    const storedMaterialInfo = await corpApi['getMaterial'](
      divisionName,
      BENCHMARK_OFFICE,
      materialName
    );
    const optimalAmount = optimalIndustryMaterials.get(materialName) ?? 0;
    result.set(materialName, optimalAmount + storedMaterialInfo.stored);
  }
  return result;
}

async function getAffordableResearchUpgrades(
  nsLocator: NetscriptLocator,
  divisionName: string
) {
  const corpApi = nsLocator.corporation;
  const divisionInfo = await corpApi['getDivision'](divisionName);
  const researchPriorities = divisionInfo.makesProducts
    ? RESEARCH_PRIORITIES_PRODUCT_DIVISION
    : RESEARCH_PRIORITIES_SUPPORT_DIVISION;
  const result = [];
  let availableResearchPoints = divisionInfo.researchPoints;
  for (const researchUpgrade of researchPriorities) {
    const upgradeCost = await corpApi['getResearchCost'](
      divisionName,
      researchUpgrade.name
    );
    const upgradeAffordable =
      availableResearchPoints >=
      upgradeCost * researchUpgrade.safetyCostMultiplier;
    if (
      !(await corpApi['hasResearched'](divisionName, researchUpgrade.name)) &&
      upgradeAffordable
    ) {
      availableResearchPoints -= upgradeCost;
      result.push(researchUpgrade.name);
    } else if (!upgradeAffordable) {
      break;
    }
  }

  return result;
}

export {
  OfficeAssignments,
  getUpgradeCost,
  getAdvertCost,
  getWarehouseCost,
  getMaxAffordableUpgradeLevel,
  getMaxAffordableAdvertLevel,
  getMaxAffordableOfficeSize,
  getMaxAffordableWarehouseLevel,
  getWarehouseSize,
  getAdvertisingFactor,
  getDivisionProductLimit,
  getDivisionProductionMultiplier,
  getOfficeProductionMultiplier,
  getOfficeMaxProduction,
  getOfficeLimitedProduction,
  generateOfficeAssignments,
  calculateAssignmentCounts,
  getBusinessFactor,
  getPricingBalanceFactor,
  addStockedIndustryMaterials,
  getAffordableResearchUpgrades,
};
