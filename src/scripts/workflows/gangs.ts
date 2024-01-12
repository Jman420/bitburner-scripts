import {
  GangGenInfo,
  GangMemberAscension,
  GangMemberInfo,
  GangTaskStats,
  NS,
} from '@ns';
import {
  NetscriptLocator,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';

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

const GANGS_MONITOR_SCRIPT = 'scripts/gang-monitor.js';
const GANG_MANAGER_SCRIPT = 'scripts/gang-manager.js';

const ASCENSION_COMBAT_PROPERTIES: Array<keyof GangMemberInfo> = [
  'agi_asc_mult',
  'def_asc_mult',
  'dex_asc_mult',
  'str_asc_mult',
];
const ASCENSION_HACKING_PROPERTIES: Array<keyof GangMemberInfo> = [
  'hack_asc_mult',
];
const ASCENSION_CHARISMA_PROPERTIES: Array<keyof GangMemberInfo> = [
  'cha_asc_mult',
];
const ASCENSION_SCORE_PROPERTIES: Array<keyof GangMemberInfo> =
  ASCENSION_COMBAT_PROPERTIES.concat(ASCENSION_HACKING_PROPERTIES).concat(
    ASCENSION_CHARISMA_PROPERTIES
  );

const SKILL_COMBAT_PROPERTIES: Array<keyof GangMemberInfo> = [
  'agi',
  'def',
  'dex',
  'str',
];
const SKILL_HACKING_PROPERTIES: Array<keyof GangMemberInfo> = ['hack'];
const SKILL_CHARISMA_PROPERTIES: Array<keyof GangMemberInfo> = ['cha'];
const SKILL_SCORE_PROPERTIES: Array<keyof GangMemberInfo> =
  SKILL_COMBAT_PROPERTIES.concat(SKILL_HACKING_PROPERTIES).concat(
    SKILL_CHARISMA_PROPERTIES
  );

const ASCENSION_COMBAT_CHECKS: Array<keyof GangMemberAscension> = [
  'agi',
  'def',
  'dex',
  'str',
];
const ASCENSION_HACKING_CHECKS: Array<keyof GangMemberAscension> = ['hack'];
const ASCENSION_CHARISMA_CHECKS: Array<keyof GangMemberAscension> = ['cha'];
const ASCENSION_CHECKS: Array<keyof GangMemberAscension> =
  ASCENSION_COMBAT_CHECKS.concat(ASCENSION_HACKING_CHECKS).concat(
    ASCENSION_CHARISMA_CHECKS
  );

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

  const membersRecruited = new Array<MemberDetails>();
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
  const netscript = nsPackage.netscript;

  let memberNames = netscript.gang.getMemberNames();
  if (memberName) {
    memberNames = [memberName];
  }

  const results = new Array<MemberDetails>();
  for (const name of memberNames) {
    const memberInfo = await nsLocator.gang['getMemberInformation'](name);
    let ascensionScore = 0;
    for (const ascensionProperty of ASCENSION_SCORE_PROPERTIES) {
      ascensionScore += memberInfo[ascensionProperty] as number;
    }

    let skillScore = 0;
    for (const skillProperty of SKILL_SCORE_PROPERTIES) {
      skillScore += memberInfo[skillProperty] as number;
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

function memberStatsSatisfyLimit(
  memberDetails: MemberDetails,
  statsProperties: Array<keyof MemberDetails>,
  statsLimit: number
) {
  let result = true;
  for (
    let propertyCounter = 0;
    propertyCounter < statsProperties.length && result;
    propertyCounter++
  ) {
    const propertyName = statsProperties[propertyCounter];
    const propertyValue = memberDetails[propertyName] as number;
    result = result && propertyValue >= statsLimit;
  }
  return result;
}

function ascensionStatsSatisfyLimit(
  ascensionDetails: GangMemberAscension,
  statsProperties: Array<keyof GangMemberAscension>,
  statsLimit: number
) {
  let result = true;
  for (
    let propertyCounter = 0;
    propertyCounter < statsProperties.length && result;
    propertyCounter++
  ) {
    const propertyName = statsProperties[propertyCounter];
    const propertyValue = ascensionDetails[propertyName] as number;
    result = result && propertyValue >= statsLimit;
  }
  return result;
}

async function ascendEligible(
  nsLocator: NetscriptLocator,
  memberName: string,
  statFactorIncreaseLimit: number
) {
  const ascentionResults =
    await nsLocator.gang['getAscensionResult'](memberName);
  if (!ascentionResults) {
    return false;
  }

  let checksPassed = 0;
  for (
    let propertyCounter = 0;
    propertyCounter < ASCENSION_CHECKS.length;
    propertyCounter++
  ) {
    const ascentionProperty = ASCENSION_CHECKS[propertyCounter];
    if (ascentionResults[ascentionProperty] >= statFactorIncreaseLimit) {
      checksPassed++;
    }
  }
  return checksPassed >= 2;
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
  const netscript = nsPackage.netscript;

  const equipmentList = netscript.gang.getEquipmentNames();
  const equipmentCosts = new Array<EquipmentCost>();
  for (const equipmentName of equipmentList) {
    const costDetails = {
      name: equipmentName,
      cost: await nsLocator.gang['getEquipmentCost'](equipmentName),
      type: await nsLocator.gang['getEquipmentType'](equipmentName),
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
      ? ascensionStatsSatisfyLimit(
          ascensionResults,
          ASCENSION_COMBAT_CHECKS,
          ascensionFactorIncreaseLimit
        )
      : false,
    combatAscensionLimitReached: memberStatsSatisfyLimit(
      memberDetails,
      ASCENSION_COMBAT_PROPERTIES,
      trainingAscensionLimit
    ),
    combatSkillLimitReached: memberStatsSatisfyLimit(
      memberDetails,
      SKILL_COMBAT_PROPERTIES,
      trainingSkillLimit
    ),
    hackingAscensionReady: ascensionResults
      ? ascensionStatsSatisfyLimit(
          ascensionResults,
          ASCENSION_HACKING_CHECKS,
          ascensionFactorIncreaseLimit
        )
      : false,
    hackingAscensionLimitReached: memberStatsSatisfyLimit(
      memberDetails,
      ASCENSION_HACKING_PROPERTIES,
      trainingAscensionLimit
    ),
    hackingSkillLimitReached: memberStatsSatisfyLimit(
      memberDetails,
      SKILL_HACKING_PROPERTIES,
      trainingSkillLimit
    ),
    charismaAscensionReady: ascensionResults
      ? ascensionStatsSatisfyLimit(
          ascensionResults,
          ASCENSION_CHARISMA_CHECKS,
          ascensionFactorIncreaseLimit
        )
      : false,
    charismaAscensionLimitReached: memberStatsSatisfyLimit(
      memberDetails,
      ASCENSION_CHARISMA_PROPERTIES,
      trainingAscensionLimit
    ),
    charismaSkillLimitReached: memberStatsSatisfyLimit(
      memberDetails,
      SKILL_CHARISMA_PROPERTIES,
      trainingSkillLimit
    ),
  };
  return result;
}

function getVigilanteTaskDetails(netscript: NS) {
  const taskNames = netscript.gang.getTaskNames();

  for (const taskName of taskNames) {
    const taskDetails = netscript.gang.getTaskStats(taskName);
    if (taskDetails.baseWanted < 0) {
      return taskDetails;
    }
  }

  throw new Error('Unable to find vigilante task!');
}

// Adapted from game source code to bypass Formulas.exe requirement (https://github.com/bitburner-official/bitburner-src/blob/6a76e1a9ab58d9b6f103c90793307c61a668334f/src/Gang/formulas/formulas.ts#L15)
//   NOTE : Eliminated calculations related to territory penalty because it uses a BitNode based modifier and scales all tasks similarly (i dont think it will impact the decision logic)
function getRespectGainIncrease(
  gangInfo: GangGenInfo,
  memberDetails: MemberDetails,
  taskDetails: GangTaskStats
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
  const respectWeight =
    gangInfo.respect / (gangInfo.respect + gangInfo.wantedLevel);
  return (
    11 * taskDetails.baseRespect * statsWeight * territoryWeight * respectWeight
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

function getCriminalTaskDetails(netscript: NS, taskName?: string) {
  let taskNames = netscript.gang
    .getTaskNames()
    .filter(value => !SPECIAL_CASE_TASKS.includes(value));
  if (taskName) {
    taskNames = [taskName];
  }

  const result = new Array<GangTaskStats>();
  for (const name of taskNames) {
    const taskInfo = netscript.gang.getTaskStats(name);

    if (taskInfo.baseWanted > 0) {
      result.push(taskInfo);
    }
  }
  return result;
}

export {
  TaskFocus,
  GangManagerConfig,
  EquipmentCost,
  MemberDetails,
  GANGS_MONITOR_SCRIPT,
  GANG_MANAGER_SCRIPT,
  ASCENSION_COMBAT_PROPERTIES,
  ASCENSION_HACKING_PROPERTIES,
  ASCENSION_CHARISMA_PROPERTIES,
  ASCENSION_SCORE_PROPERTIES,
  SKILL_COMBAT_PROPERTIES,
  SKILL_HACKING_PROPERTIES,
  SKILL_CHARISMA_PROPERTIES,
  SKILL_SCORE_PROPERTIES,
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
  memberStatsSatisfyLimit,
  ascensionStatsSatisfyLimit,
  ascendEligible,
  ascendGangMember,
  getUpgradeCosts,
  getTrainingStatus,
  getVigilanteTaskDetails,
  getRespectGainIncrease,
  getWantedLevelGainIncrease,
  getCriminalTaskDetails,
};
