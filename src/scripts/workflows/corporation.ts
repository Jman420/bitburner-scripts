import {
  CityName,
  CorpIndustryName,
  CorpMaterialName,
  CorpStateName,
  NS,
} from '@ns';

const INDUSTRY_MULTIPLIER_MATERIALS: CorpMaterialName[] = [
  'Hardware',
  'AI Cores',
  'Robots',
  'Real Estate',
];

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
  totalAmount: number
) {
  const buyAmount = totalAmount / 10;
  netscript.corporation.buyMaterial(
    divisionName,
    cityName,
    materialName,
    buyAmount
  );
  await waitForState(netscript, 'PURCHASE');
  netscript.corporation.buyMaterial(divisionName, cityName, materialName, 0);
}

export {
  INDUSTRY_MULTIPLIER_MATERIALS,
  getOptimalIndustryMaterials,
  waitForState,
  buyMaterial,
};
