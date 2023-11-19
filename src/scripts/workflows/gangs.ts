import {GangMemberAscension, GangMemberInfo, GangTaskStats, NS} from '@ns';

interface EquipmentCost {
  name: string;
  cost: number;
  type: string;
}

interface MemberDetails extends GangMemberInfo {
  ascension_score: number;
  skill_score: number;
}

interface ReputationTaskDetails extends GangTaskStats {
  score: number;
}

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

const ASCENSION_FACTOR_INCREASE = 2;
const ASCENSION_CHECKS: Array<keyof GangMemberAscension> = [
  'agi',
  'cha',
  'def',
  'dex',
  'hack',
  'str',
];

const AUGMENTATIONS_UPGRADES_TYPE = 'Augmentations';

const COMBAT_TRAINING_TASK = 'Train Combat';
const HACKING_TRAINING_TASK = 'Train Hacking';
const CHARISMA_TRAINING_TASK = 'Train Charisma';
const TRAINING_TASKS = [
  COMBAT_TRAINING_TASK,
  HACKING_TRAINING_TASK,
  CHARISMA_TRAINING_TASK,
];

const WAR_PARTY_TASK = 'Territory Warfare';
const VIGILANTE_TASK = 'Vigilante Justice';
const UNASSIGNED_TASK = 'Unassigned';
const SPECIAL_CASE_TASKS = [
  COMBAT_TRAINING_TASK,
  HACKING_TRAINING_TASK,
  CHARISMA_TRAINING_TASK,
  WAR_PARTY_TASK,
  VIGILANTE_TASK,
  UNASSIGNED_TASK,
];

function recruitAvailableMembers(
  netscript: NS,
  memberNamePrefix: string,
  memberCount: number
) {
  const membersRecruited = new Array<MemberDetails>();
  for (
    let newMemberName = `${memberNamePrefix}${memberCount}`;
    netscript.gang.recruitMember(newMemberName);
    newMemberName = `${memberNamePrefix}${memberCount}`
  ) {
    const memberDetails = getMemberDetails(netscript, newMemberName);
    membersRecruited.push(...memberDetails);
    memberCount++;
  }
  return membersRecruited;
}

function getMemberDetails(netscript: NS, memberName?: string) {
  let memberNames = netscript.gang.getMemberNames();
  if (memberName) {
    memberNames = [memberName];
  }

  const results = new Array<MemberDetails>();
  for (const name of memberNames) {
    const memberInfo = netscript.gang.getMemberInformation(name);
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
      ascension_score: ascensionScore,
      skill_score: skillScore,
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

function ascendEligible(netscript: NS, memberName: string) {
  const ascentionResults = netscript.gang.getAscensionResult(memberName);
  if (!ascentionResults) {
    return false;
  }

  let result = true;
  for (
    let propertyCounter = 0;
    propertyCounter < ASCENSION_CHECKS.length && result;
    propertyCounter++
  ) {
    const ascentionProperty = ASCENSION_CHECKS[propertyCounter];
    result =
      result &&
      ascentionResults[ascentionProperty] >= ASCENSION_FACTOR_INCREASE;
  }
  return result;
}

function ascendMember(netscript: NS, memberName: string) {
  netscript.gang.ascendMember(memberName);
  return getMemberDetails(netscript, memberName)[0];
}

function getEquipmentCosts(netscript: NS) {
  const equipmentList = netscript.gang.getEquipmentNames();
  const equipmentCosts = new Array<EquipmentCost>();
  for (const equipmentName of equipmentList) {
    const costDetails = {
      name: equipmentName,
      cost: netscript.gang.getEquipmentCost(equipmentName),
      type: netscript.gang.getEquipmentType(equipmentName),
    };

    equipmentCosts.push(costDetails);
  }
  return equipmentCosts;
}

function getCriminalTaskDetails(netscript: NS, taskName?: string) {
  let taskNames = netscript.gang
    .getTaskNames()
    .filter(value => !SPECIAL_CASE_TASKS.includes(value));
  if (taskName) {
    taskNames = [taskName];
  }

  const result = new Array<ReputationTaskDetails>();
  for (const name of taskNames) {
    const taskInfo = netscript.gang.getTaskStats(name);
    const score = taskInfo.difficulty;
    result.push({...taskInfo, score: score});
  }
  return result;
}

export {
  EquipmentCost,
  MemberDetails,
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
  VIGILANTE_TASK,
  UNASSIGNED_TASK,
  SPECIAL_CASE_TASKS,
  recruitAvailableMembers,
  getMemberDetails,
  memberStatsSatisfyLimit,
  ascendEligible,
  ascendMember,
  getEquipmentCosts,
  getCriminalTaskDetails,
};
