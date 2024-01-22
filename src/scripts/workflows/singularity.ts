import {CityName, Multipliers, NS, UniversityClassType} from '@ns';

import {HOME_SERVER_NAME} from '/scripts/common/shared';

import {UniversityName} from '/scripts/data/university-enums';
import {UniversityData} from '/scripts/data/university-data';

import {
  NetscriptLocator,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';
import {ProgramName} from '/scripts/data/program-enums';
import {ProgramData} from '/scripts/data/program-data';

// Multiplier Property Key ; Value should be greater than 1
const AUGMENTATION_STAT_PROPERTIES = [
  'hacking',
  'hacking_chance',
  'hacking_exp',
  'hacking_grow',
  'hacking_money',
  'hacking_speed',
  'hacknet_node_core_cost',
  'hacknet_node_level_cost',
  'hacknet_node_money',
  'hacknet_node_purchase_cost',
  'hacknet_node_ram_cost',
] as (keyof Multipliers)[];

async function attendCourse(
  nsPackage: NetscriptPackage,
  universityName: UniversityName,
  courseType: UniversityClassType,
  waitDelay = 500
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const singularityApi = nsLocator.singularity;
  const playerInfo = netscript.getPlayer();
  const universityData = UniversityData[universityName];
  while (
    playerInfo.city !== universityData.city &&
    !(await singularityApi['travelToCity'](universityData.city as CityName))
  ) {
    await netscript.asleep(waitDelay);
  }
  await singularityApi['universityCourse'](universityData.name, courseType);
}

async function backdoorHost(nsLocator: NetscriptLocator, hostPath: string[]) {
  const singularityApi = nsLocator.singularity;
  for (const hostname of hostPath) {
    await singularityApi['connect'](hostname);
  }
  await singularityApi['installBackdoor']();
  await singularityApi['connect'](HOME_SERVER_NAME);
}

function getRemainingPrograms(netscript: NS) {
  return Object.values(ProgramName)
    .map(value => value.toString())
    .filter(value => {
      const programData = ProgramData[value];
      return !netscript.fileExists(programData.name, HOME_SERVER_NAME);
    });
}

async function getEligibleAugmentations(
  nsPackage: NetscriptPackage,
  sortByCost = true
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;

  const playerInfo = netscript.getPlayer();
  const ownedAugs = await singularityApi['getOwnedAugmentations'](true);
  const eligibleAugs = new Map<string, string>();
  for (const factionName of playerInfo.factions) {
    const factionAugs =
      await singularityApi['getAugmentationsFromFaction'](factionName);
    for (const augName of factionAugs) {
      if (eligibleAugs.has(augName)) {
        continue;
      }

      const augStats = await singularityApi['getAugmentationStats'](augName);
      let eligible = false;
      for (
        let statCounter = 0;
        statCounter < AUGMENTATION_STAT_PROPERTIES.length && !eligible;
        statCounter++
      ) {
        const statKey = AUGMENTATION_STAT_PROPERTIES[statCounter];
        const preRequisites =
          await singularityApi['getAugmentationPrereq'](augName);
        eligible = preRequisites
          .map(preReqName => ownedAugs.includes(preReqName))
          .reduce(
            (aggregateValue, currentValue) => aggregateValue && currentValue,
            true
          );
        eligible = eligible && augStats[statKey] !== 1;
      }
      if (eligible) {
        eligibleAugs.set(augName, factionName);
      }
    }
  }

  const augmentationDetails = [];
  for (const [augmentationName, faction] of eligibleAugs.entries()) {
    const price =
      await singularityApi['getAugmentationPrice'](augmentationName);
    const reputationReq =
      await singularityApi['getAugmentationRepReq'](augmentationName);
    augmentationDetails.push({
      name: augmentationName,
      price: price,
      reputation: reputationReq,
      faction: faction,
    });
  }
  if (sortByCost) {
    augmentationDetails.sort((valueA, valueB) => valueB.price - valueA.price);
  }
  return augmentationDetails;
}

export {
  attendCourse,
  backdoorHost,
  getRemainingPrograms,
  getEligibleAugmentations,
};
