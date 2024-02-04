import {
  BitNodeMultipliers,
  GangGenInfo,
  GangMemberAscension,
  GangMemberInfo,
  GangTaskStats,
} from '@ns';

import {
  NetscriptLocator,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';

import {SCRIPTS_DIR} from '/scripts/common/shared';

type AscentionProperties<T> = {
  [K in keyof T as K extends `${infer Prefix}_asc_mult` ? K : never]: T[K];
};

enum TaskFocus {
  RESPECT = 'respect',
  MONEY = 'money',
}

interface GangManagerConfig {
  buyAugmentations: boolean;
  buyEquipment: boolean;
  taskFocus: TaskFocus;
}

interface EquipmentCost {
  name: string;
  cost: number;
  type: string;
}

interface MemberDetails extends GangMemberInfo {
  ascensionScore: number;
  skillScore: number;
}

interface TrainingStatus {
  memberName: string;
  combatAscensionReady: boolean;
  combatAscensionLimitReached: boolean;
  combatSkillLimitReached: boolean;
  hackingAscensionReady: boolean;
  hackingAscensionLimitReached: boolean;
  hackingSkillLimitReached: boolean;
  charismaAscensionReady: boolean;
  charismaAscensionLimitReached: boolean;
  charismaSkillLimitReached: boolean;
}

interface MemberStatCheck {
  ascentionMultiplier: keyof AscentionProperties<GangMemberInfo>;
  skillProperty: keyof GangMemberInfo & keyof GangMemberAscension;
}

const GANGS_MONITOR_SCRIPT = `${SCRIPTS_DIR}/gang-monitor.js`;
const GANG_MANAGER_SCRIPT = `${SCRIPTS_DIR}/gang-manager.js`;

const COMBAT_STAT_CHECKS: MemberStatCheck[] = [
  {ascentionMultiplier: 'agi_asc_mult', skillProperty: 'agi'},
  {ascentionMultiplier: 'def_asc_mult', skillProperty: 'def'},
  {ascentionMultiplier: 'dex_asc_mult', skillProperty: 'dex'},
  {ascentionMultiplier: 'str_asc_mult', skillProperty: 'str'},
];
const HACKING_STAT_CHECKS: MemberStatCheck[] = [
  {ascentionMultiplier: 'hack_asc_mult', skillProperty: 'hack'},
];
const CHARISMA_STAT_CHECKS: MemberStatCheck[] = [
  {ascentionMultiplier: 'cha_asc_mult', skillProperty: 'cha'},
];
const MEMBER_STAT_CHECKS =
  COMBAT_STAT_CHECKS.concat(HACKING_STAT_CHECKS).concat(CHARISMA_STAT_CHECKS);

const AUGMENTATIONS_UPGRADES_TYPE = 'Augmentation';

const COMBAT_TRAINING_TASK = 'Train Combat';
const HACKING_TRAINING_TASK = 'Train Hacking';
const CHARISMA_TRAINING_TASK = 'Train Charisma';
const TRAINING_TASKS = [
  COMBAT_TRAINING_TASK,
  HACKING_TRAINING_TASK,
  CHARISMA_TRAINING_TASK,
];

const WAR_PARTY_TASK = 'Territory Warfare';
const UNASSIGNED_TASK = 'Unassigned';
const SPECIAL_CASE_TASKS = [
  COMBAT_TRAINING_TASK,
  HACKING_TRAINING_TASK,
  CHARISMA_TRAINING_TASK,
  WAR_PARTY_TASK,
  UNASSIGNED_TASK,
];

async function recruitAvailableMembers(
  nsPackage: NetscriptPackage,
  memberNamePrefix: string,
  memberCount: number
) {
  const nsLocator = nsPackage.locator;

  const membersRecruited = [];
  let counter = 0;
  let memberRecruited = true;
  while (counter < memberCount + 1 || memberRecruited) {
    const newMemberName = `${memberNamePrefix}${counter}`;
    memberRecruited = await nsLocator.gang['recruitMember'](newMemberName);
    if (memberRecruited) {
      const memberDetails = await getMemberDetails(nsPackage, newMemberName);
      membersRecruited.push(...memberDetails);
    }
    counter++;
  }

  return membersRecruited;
}

async function getMemberDetails(
  nsPackage: NetscriptPackage,
  memberName?: string
) {
  const nsLocator = nsPackage.locator;
  const gangApi = nsLocator.gang;

  let memberNames = await gangApi['getMemberNames']();
  if (memberName) {
    memberNames = [memberName];
  }

  const results = [];
  for (const name of memberNames) {
    const memberInfo = await gangApi['getMemberInformation'](name);
    let ascensionScore = 0;
    let skillScore = 0;
    for (const statCheck of MEMBER_STAT_CHECKS) {
      ascensionScore += memberInfo[statCheck.ascentionMultiplier];
      skillScore += memberInfo[statCheck.skillProperty];
    }

    const memberDetails: MemberDetails = {
      ...memberInfo,
      ascensionScore: ascensionScore,
      skillScore: skillScore,
    };
    results.push(memberDetails);
  }
  return results;
}

function memberMultipliersSatisfyLimit(
  memberDetails: MemberDetails,
  statChecks: MemberStatCheck[],
  statsLimit: number
) {
  let result = true;
  for (
    let checkCounter = 0;
    checkCounter < statChecks.length && result;
    checkCounter++
  ) {
    const propertyName = statChecks[checkCounter].ascentionMultiplier;
    const propertyValue = memberDetails[propertyName] as number;
    result = result && propertyValue >= statsLimit;
  }
  return result;
}

function memberSkillsSatisfyLimit(
  memberDetails: MemberDetails,
  statChecks: MemberStatCheck[],
  statsLimit: number
) {
  let result = true;
  for (
    let checkCounter = 0;
    checkCounter < statChecks.length && result;
    checkCounter++
  ) {
    const propertyName = statChecks[checkCounter].skillProperty;
    const propertyValue = memberDetails[propertyName] as number;
    result = result && propertyValue >= statsLimit;
  }
  return result;
}

function ascensionIncreasesSatisfyLimit(
  ascensionDetails: GangMemberAscension,
  statChecks: MemberStatCheck[],
  statsLimit: number
) {
  let result = true;
  for (
    let propertyCounter = 0;
    propertyCounter < statChecks.length && result;
    propertyCounter++
  ) {
    const propertyName = statChecks[propertyCounter].skillProperty;
    const propertyValue = ascensionDetails[propertyName] as number;
    result = result && propertyValue >= statsLimit;
  }
  return result;
}

async function ascendEligible(
  nsLocator: NetscriptLocator,
  memberName: string,
  ascentionFactorIncreaseLimit: number,
  trainingAscensionLimit: number
) {
  const gangApi = nsLocator.gang;

  const ascentionResults = await gangApi['getAscensionResult'](memberName);
  if (!ascentionResults) {
    return false;
  }

  const memberInfo = await gangApi['getMemberInformation'](memberName);
  let ascentionIncreaseChecksPassed = 0;
  let correctionAscentionNeeded = false;
  for (
    let statCounter = 0;
    statCounter < MEMBER_STAT_CHECKS.length &&
    ascentionIncreaseChecksPassed < 2 &&
    !correctionAscentionNeeded;
    statCounter++
  ) {
    const statCheck = MEMBER_STAT_CHECKS[statCounter];
    const ascentionIncrease = ascentionResults[statCheck.skillProperty];
    if (ascentionIncrease >= ascentionFactorIncreaseLimit) {
      ascentionIncreaseChecksPassed++;
    }

    const currentStatMultiplier = memberInfo[statCheck.ascentionMultiplier];
    if (
      currentStatMultiplier < trainingAscensionLimit &&
      currentStatMultiplier * ascentionIncrease >= trainingAscensionLimit
    ) {
      correctionAscentionNeeded = true;
    }
  }

  return ascentionIncreaseChecksPassed > 1 || correctionAscentionNeeded;
}

async function ascendGangMember(
  nsPackage: NetscriptPackage,
  memberName: string
) {
  const nsLocator = nsPackage.locator;
  await nsLocator.gang['ascendMember'](memberName);
  return (await getMemberDetails(nsPackage, memberName))[0];
}

async function getUpgradeCosts(nsPackage: NetscriptPackage) {
  const nsLocator = nsPackage.locator;
  const gangApi = nsLocator.gang;

  const equipmentList = await gangApi['getEquipmentNames']();
  const equipmentCosts = [];
  for (const equipmentName of equipmentList) {
    const costDetails = {
      name: equipmentName,
      cost: await gangApi['getEquipmentCost'](equipmentName),
      type: await gangApi['getEquipmentType'](equipmentName),
    };

    equipmentCosts.push(costDetails);
  }
  return equipmentCosts;
}

function getTrainingStatus(
  memberDetails: MemberDetails,
  ascensionResults: GangMemberAscension | undefined,
  ascensionFactorIncreaseLimit: number,
  trainingAscensionLimit: number,
  trainingSkillLimit: number
) {
  const result: TrainingStatus = {
    memberName: memberDetails.name,
    combatAscensionReady: ascensionResults
      ? ascensionIncreasesSatisfyLimit(
          ascensionResults,
          COMBAT_STAT_CHECKS,
          ascensionFactorIncreaseLimit
        )
      : false,
    combatAscensionLimitReached: memberSkillsSatisfyLimit(
      memberDetails,
      COMBAT_STAT_CHECKS,
      trainingAscensionLimit
    ),
    combatSkillLimitReached: memberSkillsSatisfyLimit(
      memberDetails,
      COMBAT_STAT_CHECKS,
      trainingSkillLimit
    ),
    hackingAscensionReady: ascensionResults
      ? ascensionIncreasesSatisfyLimit(
          ascensionResults,
          HACKING_STAT_CHECKS,
          ascensionFactorIncreaseLimit
        )
      : false,
    hackingAscensionLimitReached: memberSkillsSatisfyLimit(
      memberDetails,
      HACKING_STAT_CHECKS,
      trainingAscensionLimit
    ),
    hackingSkillLimitReached: memberSkillsSatisfyLimit(
      memberDetails,
      HACKING_STAT_CHECKS,
      trainingSkillLimit
    ),
    charismaAscensionReady: ascensionResults
      ? ascensionIncreasesSatisfyLimit(
          ascensionResults,
          CHARISMA_STAT_CHECKS,
          ascensionFactorIncreaseLimit
        )
      : false,
    charismaAscensionLimitReached: memberSkillsSatisfyLimit(
      memberDetails,
      CHARISMA_STAT_CHECKS,
      trainingAscensionLimit
    ),
    charismaSkillLimitReached: memberSkillsSatisfyLimit(
      memberDetails,
      CHARISMA_STAT_CHECKS,
      trainingSkillLimit
    ),
  };
  return result;
}

async function getVigilanteTaskDetails(nsLocator: NetscriptLocator) {
  const gangApi = nsLocator.gang;
  const taskNames = await gangApi['getTaskNames']();

  for (const taskName of taskNames) {
    const taskDetails = await gangApi['getTaskStats'](taskName);
    if (taskDetails.baseWanted < 0) {
      return taskDetails;
    }
  }

  throw new Error('Unable to find vigilante task!');
}

// Adapted from game source code to bypass Formulas.exe requirement (https://github.com/bitburner-official/bitburner-src/blob/6a76e1a9ab58d9b6f103c90793307c61a668334f/src/Gang/formulas/formulas.ts#L15)
function getRespectGainIncrease(
  gangInfo: GangGenInfo,
  memberDetails: MemberDetails,
  taskDetails: GangTaskStats,
  bitNodeModifiers: BitNodeMultipliers
) {
  if (taskDetails.baseRespect === 0) {
    return 0;
  }

  let statsWeight =
    (taskDetails.hackWeight / 100) * memberDetails.hack +
    (taskDetails.strWeight / 100) * memberDetails.str +
    (taskDetails.defWeight / 100) * memberDetails.def +
    (taskDetails.dexWeight / 100) * memberDetails.dex +
    (taskDetails.agiWeight / 100) * memberDetails.agi +
    (taskDetails.chaWeight / 100) * memberDetails.cha;
  statsWeight -= 4 * taskDetails.difficulty;
  if (statsWeight <= 0) {
    return 0;
  }

  const territoryWeight = Math.max(
    0.005,
    Math.pow(gangInfo.territory * 100, taskDetails.territory.respect) / 100
  );
  const territoryPenalty =
    (0.2 * gangInfo.territory + 0.8) * bitNodeModifiers.GangSoftcap;
  const respectWeight =
    gangInfo.respect / (gangInfo.respect + gangInfo.wantedLevel);
  return Math.pow(
    11 *
      taskDetails.baseRespect *
      statsWeight *
      territoryWeight *
      respectWeight,
    territoryPenalty
  );
}

// Adapted from game source code to bypass Formulas.exe requirement (https://github.com/bitburner-official/bitburner-src/blob/6a76e1a9ab58d9b6f103c90793307c61a668334f/src/Gang/formulas/formulas.ts#L33)
function getWantedLevelGainIncrease(
  gangInfo: GangGenInfo,
  memberDetails: MemberDetails,
  taskDetails: GangTaskStats
) {
  if (taskDetails.baseWanted === 0) {
    return 0;
  }

  let statsWeight =
    (taskDetails.hackWeight / 100) * memberDetails.hack +
    (taskDetails.strWeight / 100) * memberDetails.str +
    (taskDetails.defWeight / 100) * memberDetails.def +
    (taskDetails.dexWeight / 100) * memberDetails.dex +
    (taskDetails.agiWeight / 100) * memberDetails.agi +
    (taskDetails.chaWeight / 100) * memberDetails.cha;
  statsWeight -= 3.5 * taskDetails.difficulty;

  if (statsWeight <= 0) {
    return 0;
  }

  const territoryMult = Math.max(
    0.005,
    Math.pow(gangInfo.territory * 100, taskDetails.territory.wanted) / 100
  );
  if (isNaN(territoryMult) || territoryMult <= 0) {
    return 0;
  }

  if (taskDetails.baseWanted < 0) {
    return 0.4 * taskDetails.baseWanted * statsWeight * territoryMult;
  }
  return Math.min(
    100,
    (7 * taskDetails.baseWanted) /
      Math.pow(3 * statsWeight * territoryMult, 0.8)
  );
}

async function getCriminalTaskDetails(
  nsLocator: NetscriptLocator,
  taskName?: string
) {
  const gangApi = nsLocator.gang;

  let taskNames = (await gangApi['getTaskNames']()).filter(
    value => !SPECIAL_CASE_TASKS.includes(value)
  );
  if (taskName) {
    taskNames = [taskName];
  }

  const result = [];
  for (const name of taskNames) {
    const taskInfo = await gangApi['getTaskStats'](name);

    if (taskInfo.baseWanted > 0) {
      result.push(taskInfo);
    }
  }
  return result;
}

async function gangHasIncome(nsLocator: NetscriptLocator) {
  const gangApi = nsLocator.gang;

  const gangInfo = (await gangApi['inGang']())
    ? await gangApi['getGangInformation']()
    : undefined;
  return gangInfo && gangInfo.moneyGainRate > 0;
}

export {
  TaskFocus,
  GangManagerConfig,
  EquipmentCost,
  MemberDetails,
  GANGS_MONITOR_SCRIPT,
  GANG_MANAGER_SCRIPT,
  MEMBER_STAT_CHECKS,
  AUGMENTATIONS_UPGRADES_TYPE,
  COMBAT_TRAINING_TASK,
  HACKING_TRAINING_TASK,
  CHARISMA_TRAINING_TASK,
  TRAINING_TASKS,
  WAR_PARTY_TASK,
  UNASSIGNED_TASK,
  SPECIAL_CASE_TASKS,
  recruitAvailableMembers,
  getMemberDetails,
  memberMultipliersSatisfyLimit,
  memberSkillsSatisfyLimit,
  ascensionIncreasesSatisfyLimit,
  ascendEligible,
  ascendGangMember,
  getUpgradeCosts,
  getTrainingStatus,
  getVigilanteTaskDetails,
  getRespectGainIncrease,
  getWantedLevelGainIncrease,
  getCriminalTaskDetails,
  gangHasIncome,
};
