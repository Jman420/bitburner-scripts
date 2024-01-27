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

const NEUROFLUX_NAME = 'NeuroFlux Governor';

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
  includeGang = true,
  honorPrereq = true,
  sortByCost = true
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const singularityApi = nsLocator.singularity;
  const gangApi = nsLocator.gang;

  const playerInfo = netscript.getPlayer();
  let includedFactions = playerInfo.factions;
  if (!includeGang && (await gangApi['inGang']())) {
    const gangInfo = await gangApi['getGangInformation']();
    includedFactions = includedFactions.filter(
      value => value !== gangInfo.faction
    );
  }
  const ownedAugs = await singularityApi['getOwnedAugmentations'](true);
  const eligibleAugs = new Map<string, string>();
  for (const factionName of includedFactions) {
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
        eligible =
          !ownedAugs.includes(augName) &&
          (augStats[statKey] !== 1 || augName === 'The Red Pill');
        if (honorPrereq) {
          eligible =
            eligible &&
            preRequisites
              .map(preReqName => ownedAugs.includes(preReqName))
              .reduce(
                (aggregateValue, currentValue) =>
                  aggregateValue && currentValue,
                true
              );
        }
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
    augmentationDetails.sort(
      (valueA, valueB) =>
        valueB.price - valueA.price || valueB.reputation - valueA.reputation
    );
  }
  return augmentationDetails;
}

async function getFactionsNeedReputation(nsPackage: NetscriptPackage) {
  const nsLocator = nsPackage.locator;
  const singularityApi = nsLocator.singularity;

  const eligibleAugs = await getEligibleAugmentations(nsPackage, false, false);
  eligibleAugs.sort(
    (valueA, valueB) =>
      valueB.reputation - valueA.reputation || valueB.price - valueA.price
  );
  const factionsNeedRep = new Map<string, number>(); // Key : factionName ; Value : reputation requirement
  for (const augEntry of eligibleAugs) {
    const currentFactionRep = await singularityApi['getFactionRep'](
      augEntry.faction
    );
    if (currentFactionRep < augEntry.reputation) {
      const factionRepEntry = factionsNeedRep.get(augEntry.faction);
      if (!factionRepEntry || factionRepEntry < augEntry.reputation) {
        factionsNeedRep.set(augEntry.faction, augEntry.reputation);
      }
    }
  }

  return factionsNeedRep;
}

async function getPurchasedAugmentations(nsPackage: NetscriptPackage) {
  const nsLocator = nsPackage.locator;
  const singularityApi = nsLocator.singularity;

  const allAugs = await singularityApi['getOwnedAugmentations'](true);
  const installedAugs = await singularityApi['getOwnedAugmentations'](false);
  return allAugs.slice(installedAugs.length); // Purchased augmentations are always at the end of the allAugs array
}

export {
  NEUROFLUX_NAME,
  attendCourse,
  backdoorHost,
  getRemainingPrograms,
  getEligibleAugmentations,
  getFactionsNeedReputation,
  getPurchasedAugmentations,
};
