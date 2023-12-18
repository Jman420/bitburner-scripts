import {
  CityName,
  CorpIndustryName,
  CorpMaterialName,
  CorpStateName,
  NS,
} from '@ns';

interface TeaPartyConfig {
  energyLimit: number;
  moraleLimit: number;
  partyFunds: number;
}

interface ProductLifecycleConfig {
  divisionName: string;
  designCity: CityName;
  productName: string;
  designBudget: number;
  marketingBudget: number;
}

const TEA_PARTY_SCRIPT = 'scripts/corp-tea-party.js';
const INDUSTRY_MATERIALS_SCRIPT = 'scripts/corp-materials.js';
const PRODUCT_LIFECYCLE_SCRIPT = 'scripts/corp-product.js';
const PRICING_SETUP_SCRIPT = 'scripts/corp-price.js';
const EXPORT_SETUP_SCRIPT = 'scripts/corp-export.js';

const MARKET_TA_I = 'Market-TA.I';
const MARKET_TA_II = 'Market-TA.II';
const PRODUCT_CAPACITY_I = 'uPgrade: Capacity.I';
const PRODUCT_CAPACITY_II = 'uPgrade: Capacity.II';

const EXPORT_FORMULA = '-IPROD-IINV/10';

const INDUSTRY_MULTIPLIER_MATERIALS: CorpMaterialName[] = [
  'Hardware',
  'AI Cores',
  'Robots',
  'Real Estate',
];

function getDivisions(netscript: NS) {
  return netscript.corporation.getCorporation().divisions;
}

function getOptimalIndustryMaterials(
  netscript: NS,
  industryType: CorpIndustryName,
  storageSize: number,
  wholeNumResults = true
) {
  const industryData = netscript.corporation.getIndustryData(industryType);
  const industryFactors = [
    industryData.hardwareFactor ?? 0,
    industryData.aiCoreFactor ?? 0,
    industryData.robotFactor ?? 0,
    industryData.realEstateFactor ?? 0,
  ];
  const materialSizes = INDUSTRY_MULTIPLIER_MATERIALS.map(
    materialName => netscript.corporation.getMaterialData(materialName).size
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

async function waitForState(netscript: NS, state: CorpStateName) {
  /* eslint-disable-next-line no-empty */
  while (state !== (await netscript.corporation.nextUpdate())) {}
}

async function buyMaterial(
  netscript: NS,
  divisionName: string,
  cityName: CityName,
  materialName: CorpMaterialName,
  amount: number
) {
  const buyAmount = amount / 10;
  netscript.corporation.buyMaterial(
    divisionName,
    cityName,
    materialName,
    buyAmount
  );
  await waitForState(netscript, 'PURCHASE');
  netscript.corporation.buyMaterial(divisionName, cityName, materialName, 0);
}

async function sellMaterial(
  netscript: NS,
  divisionName: string,
  cityName: CityName,
  materialName: CorpMaterialName,
  amount: number
) {
  let materialInfo = netscript.corporation.getMaterial(
    divisionName,
    cityName,
    materialName
  );
  const targetAmount = materialInfo.stored - amount;
  while (materialInfo.stored > targetAmount && materialInfo.stored > 0) {
    setMaterialMarketTA(netscript, divisionName, cityName, materialName);

    const sellAmount = materialInfo.stored - targetAmount;
    netscript.corporation.sellMaterial(
      divisionName,
      cityName,
      materialName,
      `${sellAmount}`,
      'MP'
    );
    await waitForState(netscript, 'PURCHASE');
    netscript.corporation.sellMaterial(
      divisionName,
      cityName,
      materialName,
      '0',
      'MP'
    );

    materialInfo = netscript.corporation.getMaterial(
      divisionName,
      cityName,
      materialName
    );
  }
}

function setMaterialMarketTA(
  netscript: NS,
  divisionName: string,
  cityName: CityName,
  materialName: CorpMaterialName
) {
  netscript.corporation.sellMaterial(
    divisionName,
    cityName,
    materialName,
    'MAX',
    'MP'
  );
  if (netscript.corporation.hasResearched(divisionName, MARKET_TA_I)) {
    netscript.corporation.setMaterialMarketTA1(
      divisionName,
      cityName,
      materialName,
      true
    );
  }
  if (netscript.corporation.hasResearched(divisionName, MARKET_TA_II)) {
    netscript.corporation.setMaterialMarketTA2(
      divisionName,
      cityName,
      materialName,
      true
    );
  }
}

function setProductMarketTA(
  netscript: NS,
  divisionName: string,
  productName: string
) {
  netscript.corporation.sellProduct(
    divisionName,
    'Sector-12',
    productName,
    'MAX',
    'MP',
    true
  );
  if (netscript.corporation.hasResearched(divisionName, MARKET_TA_I)) {
    netscript.corporation.setProductMarketTA1(divisionName, productName, true);
  }
  if (netscript.corporation.hasResearched(divisionName, MARKET_TA_II)) {
    netscript.corporation.setProductMarketTA2(divisionName, productName, true);
  }
}

function getDivisionProductLimit(netscript: NS, divisionName: string) {
  if (netscript.corporation.hasResearched(divisionName, PRODUCT_CAPACITY_II)) {
    return 5;
  }
  if (netscript.corporation.hasResearched(divisionName, PRODUCT_CAPACITY_I)) {
    return 4;
  }
  return 3;
}

export {
  TeaPartyConfig,
  ProductLifecycleConfig,
  TEA_PARTY_SCRIPT,
  INDUSTRY_MATERIALS_SCRIPT,
  PRODUCT_LIFECYCLE_SCRIPT,
  PRICING_SETUP_SCRIPT,
  EXPORT_SETUP_SCRIPT,
  EXPORT_FORMULA,
  INDUSTRY_MULTIPLIER_MATERIALS,
  getDivisions,
  getOptimalIndustryMaterials,
  waitForState,
  buyMaterial,
  sellMaterial,
  setMaterialMarketTA,
  setProductMarketTA,
  getDivisionProductLimit,
};
