import {AutocompleteData, GangTaskStats, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {
  ensureRunning,
  eventLoop,
  initializeScript,
} from '/scripts/workflows/execution';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {GangInfoChangedEvent} from '/scripts/comms/events/gang-info-changed-event';
import {GangEnemiesChangedEvent} from '/scripts/comms/events/gang-enemies-changed-event';
import {GangManagerConfigEvent} from '/scripts/comms/events/gang-manager-config-event';

import {
  CHARISMA_TRAINING_TASK,
  COMBAT_TRAINING_TASK,
  HACKING_TRAINING_TASK,
  WAR_PARTY_TASK,
  ASCENSION_SCORE_PROPERTIES,
  AUGMENTATIONS_UPGRADES_TYPE,
  recruitAvailableMembers,
  memberStatsSatisfyLimit,
  ascendEligible,
  ascendGangMember,
  getUpgradeCosts,
  getCriminalTaskDetails,
  getTrainingStatus,
  getMemberDetails,
  getVigilanteTaskDetails,
  TaskFocus,
  getRespectGainIncrease,
  getWantedLevelGainIncrease,
  GangManagerConfig,
  GANGS_MONITOR_SCRIPT,
} from '/scripts/workflows/gangs';

import {openTail} from '/scripts/workflows/ui';
import {GangConfigRequest} from '/scripts/comms/requests/gang-config-request';
import {GangConfigResponse} from '/scripts/comms/responses/gang-config-response';
import {
  NetscriptLocator,
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

export const CMD_FLAG_MEMBER_NAME_PREFIX = 'memberNamePrefix';
export const CMD_FLAG_PURCHASE_AUGMENTATIONS = 'purchaseAugmentations';
export const CMD_FLAG_PURCHASE_EQUIPMENT = 'purchaseEquipment';
export const CMD_FLAG_TASK_FOCUS = 'taskFocus';
export const TASK_FOCUS_RESPECT = 'respect';
export const TASK_FOCUS_MONEY = 'money';
const TASK_FOCUS_OPTIONS = [TASK_FOCUS_RESPECT, TASK_FOCUS_MONEY];
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_MEMBER_NAME_PREFIX, 'henchman-'],
  [CMD_FLAG_PURCHASE_AUGMENTATIONS, false],
  [CMD_FLAG_PURCHASE_EQUIPMENT, false],
  [CMD_FLAG_TASK_FOCUS, TASK_FOCUS_OPTIONS[0]],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'gangs-manager';
const SUBSCRIBER_NAME = 'gangs-manager';

const TAIL_X_POS = 690;
const TAIL_Y_POS = 175;
const TAIL_WIDTH = 650;
const TAIL_HEIGHT = 415;

const ASCENSION_FACTOR_INCREASE = 2;
const TRAINING_ASCENSION_LIMIT = 8;
const TRAINING_SKILL_LIMIT = 1000;
const WARTIME_CHANCE_LIMIT = 0.85;
const WAR_PARTY_SIZE = 6;
const WANTED_PENALTY_LIMIT = 0.15;

let scriptConfig: GangManagerConfig;
let formWarParty = false;
let engageWarfare = false;
let reduceWantedPenalty = false;

async function manageGang(
  eventData: GangInfoChangedEvent,
  nsPackage: NetscriptPackage,
  logWriter: Logger,
  memberNamePrefix: string
) {
  if (!eventData.gangInfo || !eventData.gangMembers) {
    return;
  }

  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const gangInfo = eventData.gangInfo;
  const gangMembers = eventData.gangMembers;
  logWriter.writeLine(`Managing gang for faction : ${gangInfo.faction}`);

  logWriter.writeLine('  Recruiting available members...');
  const newMembers = await recruitAvailableMembers(
    nsPackage,
    memberNamePrefix,
    gangMembers.length
  );
  gangMembers.push(...newMembers);
  logWriter.writeLine(`  Recruited ${newMembers.length} new members.`);

  logWriter.writeLine('  Getting augmentation & equipment costs...');
  const upgradeCosts = await getUpgradeCosts(nsPackage);
  const augmentationCosts = upgradeCosts
    .filter(value => value.type === AUGMENTATIONS_UPGRADES_TYPE)
    .sort((valueA, valueB) => valueA.cost - valueB.cost);
  const equipmentCosts = upgradeCosts
    .filter(value => value.type !== AUGMENTATIONS_UPGRADES_TYPE)
    .sort((valueA, valueB) => valueA.cost - valueB.cost);

  logWriter.writeLine('  Determining eligible tasks for members...');
  const vigilanteTaskDetails = await getVigilanteTaskDetails(nsLocator);
  const criminalTaskDetails = (await getCriminalTaskDetails(nsLocator)).sort(
    (taskA, taskB) => {
      let scoreA = 0;
      let scoreB = 0;
      if (scriptConfig.taskFocus === TaskFocus.RESPECT) {
        scoreA = taskA.baseRespect;
        scoreB = taskB.baseRespect;
      } else if (scriptConfig.taskFocus === TaskFocus.MONEY) {
        scoreA = taskA.baseMoney;
        scoreB = taskB.baseMoney;
      }

      return scoreB - scoreA || taskA.difficulty - taskB.difficulty;
    }
  );
  reduceWantedPenalty =
    (gangInfo.wantedLevel > 1 &&
      gangInfo.wantedPenalty <= 1 - WANTED_PENALTY_LIMIT) ||
    (reduceWantedPenalty && gangInfo.wantedLevel > 1);
  if (gangInfo.territory >= 1) {
    formWarParty = false;
    engageWarfare = false;
  }

  logWriter.writeLine(`  Managing ${gangMembers.length} gang members...`);
  let membersAscended = 0;
  let ascendedRespect = 0;
  let augmentationsPurchased = 0;
  let augmentationsPurchasedCost = 0;
  let equipmentPurchased = 0;
  let equipmentPurchasedCost = 0;
  gangMembers.sort(
    (memberA, memberB) => memberB.ascensionScore - memberA.ascensionScore
  );
  for (let memberDetails of gangMembers) {
    // Handle Ascension
    if (
      await ascendEligible(
        nsLocator,
        memberDetails.name,
        ASCENSION_FACTOR_INCREASE
      )
    ) {
      memberDetails = await ascendGangMember(nsPackage, memberDetails.name);
      membersAscended++;
      ascendedRespect += memberDetails.earnedRespect;
    }

    // Purchase Augmentations
    const remainingAugmentations = augmentationCosts.filter(
      value => !memberDetails.augmentations.includes(value.name)
    );
    while (
      scriptConfig.buyAugmentations &&
      remainingAugmentations.length > 0 &&
      remainingAugmentations[0].cost <= netscript.getPlayer().money
    ) {
      const augmentationDetails = remainingAugmentations.shift();
      if (!augmentationDetails) {
        break;
      }

      await nsLocator.gang['purchaseEquipment'](
        memberDetails.name,
        augmentationDetails.name
      );
      memberDetails = (
        await getMemberDetails(nsPackage, memberDetails.name)
      )[0];
      augmentationsPurchased++;
      augmentationsPurchasedCost += augmentationDetails.cost;
    }

    // Purchase Equipment
    const remainingEquipment = equipmentCosts.filter(
      value => !memberDetails.upgrades.includes(value.name)
    );
    while (
      scriptConfig.buyEquipment &&
      remainingEquipment.length > 0 &&
      remainingEquipment[0].cost <= netscript.getPlayer().money &&
      memberStatsSatisfyLimit(
        memberDetails,
        ASCENSION_SCORE_PROPERTIES,
        TRAINING_ASCENSION_LIMIT
      )
    ) {
      const equipmentDetails = remainingEquipment.shift();
      if (!equipmentDetails) {
        break;
      }

      await nsLocator.gang['purchaseEquipment'](
        memberDetails.name,
        equipmentDetails.name
      );
      memberDetails = (
        await getMemberDetails(nsPackage, memberDetails.name)
      )[0];
      equipmentPurchased++;
      equipmentPurchasedCost += equipmentDetails.cost;
    }
  }
  logWriter.writeLine(
    `    Ascended ${membersAscended} members costing ${ascendedRespect} respect`
  );
  logWriter.writeLine(
    `    Purchased ${augmentationsPurchased} augmentation upgrades for $${netscript.formatNumber(
      augmentationsPurchasedCost
    )}`
  );
  logWriter.writeLine(
    `    Purchased ${equipmentPurchased} equipment upgrades for $${netscript.formatNumber(
      equipmentPurchasedCost
    )}`
  );

  const trainingTeam = [];
  const warParty = [];
  const vigilanteGroup = [];
  const criminalCrew = [];
  const unassignedMembers = [];
  gangMembers.sort(
    (memberA, memberB) => memberB.skillScore - memberA.skillScore
  );
  for (const memberDetails of gangMembers) {
    const ascensionResult = await nsLocator.gang['getAscensionResult'](
      memberDetails.name
    );
    const trainingStatus = getTrainingStatus(
      memberDetails,
      ascensionResult,
      ASCENSION_FACTOR_INCREASE,
      TRAINING_ASCENSION_LIMIT,
      TRAINING_SKILL_LIMIT
    );

    // Handle Training
    if (
      (!trainingStatus.combatAscensionLimitReached &&
        !trainingStatus.combatAscensionReady) ||
      (trainingStatus.combatAscensionLimitReached &&
        !trainingStatus.combatSkillLimitReached)
    ) {
      await nsLocator.gang['setMemberTask'](
        memberDetails.name,
        COMBAT_TRAINING_TASK
      );
      trainingTeam.push(memberDetails);
    } else if (
      (!trainingStatus.hackingAscensionLimitReached &&
        !trainingStatus.hackingAscensionReady) ||
      (trainingStatus.hackingAscensionLimitReached &&
        !trainingStatus.hackingSkillLimitReached)
    ) {
      await nsLocator.gang['setMemberTask'](
        memberDetails.name,
        HACKING_TRAINING_TASK
      );
      trainingTeam.push(memberDetails);
    } else if (
      (!trainingStatus.charismaAscensionLimitReached &&
        !trainingStatus.charismaAscensionReady) ||
      (trainingStatus.charismaAscensionLimitReached &&
        !trainingStatus.charismaSkillLimitReached)
    ) {
      await nsLocator.gang['setMemberTask'](
        memberDetails.name,
        CHARISMA_TRAINING_TASK
      );
      trainingTeam.push(memberDetails);
    }

    // Handle Vigilantes
    else if (reduceWantedPenalty) {
      await nsLocator.gang['setMemberTask'](
        memberDetails.name,
        vigilanteTaskDetails.name
      );
      vigilanteGroup.push(memberDetails);
    }

    // Handle War Party
    else if (
      formWarParty &&
      warParty.length < WAR_PARTY_SIZE &&
      gangMembers.length > WAR_PARTY_SIZE
    ) {
      await nsLocator.gang['setMemberTask'](memberDetails.name, WAR_PARTY_TASK);
      warParty.push(memberDetails);
    }

    // Handle Criminal Tasks
    else {
      const eligibleTasks = criminalTaskDetails.filter(
        value =>
          getRespectGainIncrease(gangInfo, memberDetails, value) >
          getWantedLevelGainIncrease(gangInfo, memberDetails, value)
      );
      let crimeTask: GangTaskStats | undefined = undefined;
      let taskAssigned = false;
      for (
        let taskCounter = 0;
        taskCounter < eligibleTasks.length && !taskAssigned;
        taskCounter++
      ) {
        crimeTask = eligibleTasks[taskCounter];
        taskAssigned = await nsLocator.gang['setMemberTask'](
          memberDetails.name,
          crimeTask.name
        );
      }

      if (taskAssigned && crimeTask) {
        criminalCrew.push(memberDetails);
      } else {
        unassignedMembers.push(memberDetails);
      }
    }
  }
  await nsLocator.gang['setTerritoryWarfare'](engageWarfare);

  logWriter.writeLine(
    `    Assigned ${trainingTeam.length} members to training`
  );
  logWriter.writeLine(
    `    Assigned ${warParty.length} members to territorial warfare`
  );
  logWriter.writeLine(`    Warfare engaged : ${engageWarfare}`);
  logWriter.writeLine(
    `    Assigned ${vigilanteGroup.length} members to vigilante justice`
  );
  logWriter.writeLine(
    `    Assigned ${criminalCrew.length} members to criminal tasks`
  );
  logWriter.writeLine(
    `    Unassigned member count : ${unassignedMembers.length}`
  );
  logWriter.writeLine(ENTRY_DIVIDER);
}

async function handleEnemiesChangedEvent(
  eventData: GangEnemiesChangedEvent,
  nsLocator: NetscriptLocator
) {
  if (!eventData.enemiesInfo || !eventData.enemyNames) {
    return;
  }

  const otherGangsInfo = eventData.enemiesInfo;
  const otherGangNames = eventData.enemyNames;
  formWarParty = false;
  engageWarfare = false;
  for (
    let gangNameIndex = 0;
    gangNameIndex < otherGangNames.length && (!formWarParty || !engageWarfare);
    gangNameIndex++
  ) {
    const gangName = otherGangNames[gangNameIndex];
    const gangTerritory = otherGangsInfo[gangName].territory;
    formWarParty = formWarParty || gangTerritory > 0;
    engageWarfare =
      engageWarfare ||
      (gangTerritory > 0 &&
        (await nsLocator.gang['getChanceToWinClash'](gangName)) >=
          WARTIME_CHANCE_LIMIT);
  }
}

function handleUpdateConfigEvent(
  eventData: GangManagerConfigEvent,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  const newConfig = eventData.config;
  scriptConfig.buyAugmentations =
    newConfig.buyAugmentations ?? scriptConfig.buyAugmentations;
  scriptConfig.buyEquipment =
    newConfig.buyEquipment ?? scriptConfig.buyEquipment;
  scriptConfig.taskFocus = newConfig.taskFocus ?? scriptConfig.taskFocus;

  logWriter.writeLine(
    `  Purchase Augmentations : ${scriptConfig.buyAugmentations}`
  );
  logWriter.writeLine(`  Purchase Equipment : ${scriptConfig.buyEquipment}`);
  logWriter.writeLine(`  Task Focus : ${scriptConfig.taskFocus}`);
}

function handleConfigRequest(
  requestData: GangConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending gang manager config response to ${requestData.sender}`
  );
  sendMessage(new GangConfigResponse(scriptConfig), requestData.sender);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Automatic Gang Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const memberNamePrefix = cmdArgs[
    CMD_FLAG_MEMBER_NAME_PREFIX
  ].valueOf() as string;
  const buyAugmentations = cmdArgs[
    CMD_FLAG_PURCHASE_AUGMENTATIONS
  ].valueOf() as boolean;
  const buyEquipment = cmdArgs[
    CMD_FLAG_PURCHASE_EQUIPMENT
  ].valueOf() as boolean;
  const taskFocusFlag = (
    cmdArgs[CMD_FLAG_TASK_FOCUS].valueOf() as string
  ).toUpperCase() as keyof typeof TaskFocus;
  const taskFocus = TaskFocus[taskFocusFlag];

  terminalWriter.writeLine(`New Member Name Prefix : ${memberNamePrefix}`);
  terminalWriter.writeLine(`Purchase Augmentations : ${buyAugmentations}`);
  terminalWriter.writeLine(`Purchase Equipment : ${buyEquipment}`);
  terminalWriter.writeLine(`Task Focus : ${taskFocus}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (!(await nsLocator.gang['inGang']())) {
    terminalWriter.writeLine(
      'Player not in a gang.  Gang must be created before running this script.'
    );
    return;
  }

  if (!ensureRunning(netscript, GANGS_MONITOR_SCRIPT)) {
    terminalWriter.writeLine(
      'Failed to find or execute the Gang Monitor script!'
    );
    return;
  }

  terminalWriter.writeLine('See script logs for on-going gang details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  scriptConfig = {
    buyAugmentations: buyAugmentations,
    buyEquipment: buyEquipment,
    taskFocus: taskFocus,
  };
  formWarParty = false;
  engageWarfare = false;
  reduceWantedPenalty = false;

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(
    GangInfoChangedEvent,
    manageGang,
    nsPackage,
    scriptLogWriter,
    memberNamePrefix
  );
  eventListener.addListener(
    GangEnemiesChangedEvent,
    handleEnemiesChangedEvent,
    nsLocator
  );
  eventListener.addListener(
    GangManagerConfigEvent,
    handleUpdateConfigEvent,
    scriptLogWriter
  );
  eventListener.addListener(
    GangConfigRequest,
    handleConfigRequest,
    scriptLogWriter
  );

  await eventLoop(netscript, eventListener);
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MEMBER_NAME_PREFIX)) {
    return ['henchman-', 'lacky-', 'goon-'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TASK_FOCUS)) {
    return TASK_FOCUS_OPTIONS;
  }
  return CMD_FLAGS;
}
