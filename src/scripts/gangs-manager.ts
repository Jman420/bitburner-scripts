import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {EventListener} from '/scripts/comms/event-comms';
import {GangsUpdateSettingsEvent} from '/scripts/comms/events/gangs-update-settings-event';

import {
  MemberDetails,
  CHARISMA_TRAINING_TASK,
  COMBAT_TRAINING_TASK,
  HACKING_TRAINING_TASK,
  VIGILANTE_TASK,
  WAR_PARTY_TASK,
  ASCENSION_SCORE_PROPERTIES,
  ASCENSION_COMBAT_PROPERTIES,
  ASCENSION_HACKING_PROPERTIES,
  ASCENSION_CHARISMA_PROPERTIES,
  SKILL_COMBAT_PROPERTIES,
  SKILL_HACKING_PROPERTIES,
  SKILL_CHARISMA_PROPERTIES,
  AUGMENTATIONS_UPGRADES_TYPE,
  recruitAvailableMembers,
  getMemberDetails,
  memberStatsSatisfyLimit,
  ascendEligible,
  ascendMember,
  getEquipmentCosts,
  getCriminalTaskDetails,
} from '/scripts/workflows/gangs';
import {openTail} from '/scripts/workflows/ui';

const CMG_FLAG_MEMBER_NAME_PREFIX = 'memberNamePrefix';
const CMD_FLAG_PURCHASE_EQUIPMENT = 'purchaseEquipment';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMG_FLAG_MEMBER_NAME_PREFIX, 'henchman-'],
  [CMD_FLAG_PURCHASE_EQUIPMENT, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'gangs-manager';
const SUBSCRIBER_NAME = 'gangs-manager';

const TAIL_X_POS = 1670;
const TAIL_Y_POS = 18;
const TAIL_WIDTH = 650;
const TAIL_HEIGHT = 415;

const UPDATE_DELAY = 3000;
const TRAINING_ASCENTION_LIMIT = 8;
const TRAINING_SKILL_LIMIT = 1000;
const WARTIME_CHANCE_LIMIT = 0.85;
const WAR_PARTY_SIZE = 6;
const MAX_WANTED_PENALTY = 0.15;

let purchaseEquipment = false;

function manageGang(
  netscript: NS,
  logWriter: Logger,
  memberNamePrefix: string
) {
  const gangInfo = netscript.gang.getGangInformation();
  const gangMembers = getMemberDetails(netscript);
  logWriter.writeLine(`Managing gang for faction : ${gangInfo.faction}`);

  logWriter.writeLine('  Recruiting available members...');
  const newMembers = recruitAvailableMembers(
    netscript,
    memberNamePrefix,
    gangMembers.length
  );
  gangMembers.push(...newMembers);
  logWriter.writeLine(`  Recruited ${newMembers.length} new members.`);

  logWriter.writeLine('  Determining eligible tasks for members...');
  const criminalTaskDetails = getCriminalTaskDetails(netscript).sort(
    (taskA, taskB) => taskB.score - taskA.score
  );
  const otherGangsInfo = netscript.gang.getOtherGangInformation();
  const otherGangNames = Object.keys(otherGangsInfo);
  let formWarParty = false;
  let engageWarfare = false;
  for (
    let gangNameIndex = 0;
    gangNameIndex < otherGangNames.length;
    gangNameIndex++
  ) {
    const gangName = otherGangNames[gangNameIndex];
    formWarParty = formWarParty || otherGangsInfo[gangName].territory > 0;
    engageWarfare =
      engageWarfare ||
      netscript.gang.getChanceToWinClash(gangName) <= WARTIME_CHANCE_LIMIT;
  }

  logWriter.writeLine('  Getting augmentation & equipment costs...');
  const equipmentCosts = getEquipmentCosts(netscript);
  equipmentCosts.sort((equipmentA, equipmentB) => {
    if (
      equipmentA.type === AUGMENTATIONS_UPGRADES_TYPE &&
      equipmentB.type !== AUGMENTATIONS_UPGRADES_TYPE
    ) {
      return 1;
    }
    return equipmentA.cost - equipmentB.cost;
  });

  logWriter.writeLine(`  Managing ${gangMembers.length} gang members...`);
  let membersAscended = 0;
  let ascendedRespect = 0;
  let itemsPurchased = 0;
  let purchasedCost = 0;
  gangMembers.sort(
    (memberA, memberB) => memberA.ascension_score - memberB.ascension_score
  );
  for (let memberDetails of gangMembers) {
    // Handle Ascension
    if (ascendEligible(netscript, memberDetails.name)) {
      const ascendedMemberDetails = ascendMember(netscript, memberDetails.name);
      memberDetails = ascendedMemberDetails;
      membersAscended++;
      ascendedRespect += memberDetails.earnedRespect;
    }

    // Purchase Equipment
    const memberUpgrades = memberDetails.augmentations.concat(
      memberDetails.upgrades
    );
    const remainingUpgrades = equipmentCosts.filter(
      value => !memberUpgrades.includes(value.name)
    );
    while (
      purchaseEquipment &&
      remainingUpgrades.length > 0 &&
      remainingUpgrades[0].cost <= netscript.getPlayer().money &&
      memberStatsSatisfyLimit(
        memberDetails,
        ASCENSION_SCORE_PROPERTIES,
        TRAINING_ASCENTION_LIMIT
      )
    ) {
      const upgradeDetails = remainingUpgrades.shift();
      if (!upgradeDetails) {
        break;
      }

      netscript.gang.purchaseEquipment(memberDetails.name, upgradeDetails.name);
      itemsPurchased++;
      purchasedCost += upgradeDetails.cost;
    }
  }
  logWriter.writeLine(
    `    Ascended ${membersAscended} members costing ${ascendedRespect} respect`
  );
  logWriter.writeLine(
    `    Purchased ${itemsPurchased} for $${netscript.formatNumber(
      purchasedCost
    )}`
  );

  const trainingTeam = new Array<MemberDetails>();
  const warParty = new Array<MemberDetails>();
  const vigilanteGroup = new Array<MemberDetails>();
  const criminalCrew = new Array<MemberDetails>();
  const unassignedMembers = new Array<MemberDetails>();
  gangMembers.sort(
    (memberA, memberB) => memberA.skill_score - memberB.skill_score
  );
  for (const memberDetails of gangMembers) {
    // Handle Training
    if (
      !memberStatsSatisfyLimit(
        memberDetails,
        ASCENSION_COMBAT_PROPERTIES,
        TRAINING_ASCENTION_LIMIT
      ) ||
      !memberStatsSatisfyLimit(
        memberDetails,
        SKILL_COMBAT_PROPERTIES,
        TRAINING_SKILL_LIMIT
      )
    ) {
      netscript.gang.setMemberTask(memberDetails.name, COMBAT_TRAINING_TASK);
      trainingTeam.push(memberDetails);
    } else if (
      !memberStatsSatisfyLimit(
        memberDetails,
        ASCENSION_HACKING_PROPERTIES,
        TRAINING_ASCENTION_LIMIT
      ) ||
      !memberStatsSatisfyLimit(
        memberDetails,
        SKILL_HACKING_PROPERTIES,
        TRAINING_SKILL_LIMIT
      )
    ) {
      netscript.gang.setMemberTask(memberDetails.name, HACKING_TRAINING_TASK);
      trainingTeam.push(memberDetails);
    } else if (
      !memberStatsSatisfyLimit(
        memberDetails,
        ASCENSION_CHARISMA_PROPERTIES,
        TRAINING_ASCENTION_LIMIT
      ) ||
      !memberStatsSatisfyLimit(
        memberDetails,
        SKILL_CHARISMA_PROPERTIES,
        TRAINING_SKILL_LIMIT
      )
    ) {
      netscript.gang.setMemberTask(memberDetails.name, CHARISMA_TRAINING_TASK);
      trainingTeam.push(memberDetails);
    }

    // Handle War Party
    else if (
      formWarParty &&
      warParty.length < WAR_PARTY_SIZE &&
      gangMembers.length > WAR_PARTY_SIZE
    ) {
      netscript.gang.setMemberTask(memberDetails.name, WAR_PARTY_TASK);
      warParty.push(memberDetails);
    }

    // Handle Vigilantes
    else if (
      gangInfo.wantedLevelGainRate > 0 &&
      gangInfo.wantedPenalty > MAX_WANTED_PENALTY
    ) {
      netscript.gang.setMemberTask(memberDetails.name, VIGILANTE_TASK);
      vigilanteGroup.push(memberDetails);
    }

    // Handle Criminal Tasks
    else {
      let taskAssigned = false;
      for (
        let taskCounter = 0;
        taskCounter < criminalTaskDetails.length && !taskAssigned;
        taskCounter++
      ) {
        const crimeTask = criminalTaskDetails[taskCounter];
        taskAssigned = netscript.gang.setMemberTask(
          memberDetails.name,
          crimeTask.name
        );
      }

      if (taskAssigned) {
        criminalCrew.push(memberDetails);
      } else {
        unassignedMembers.push(memberDetails);
      }
    }
  }
  netscript.gang.setTerritoryWarfare(engageWarfare);

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

function handleUpdateSettingsEvent(
  eventData: GangsUpdateSettingsEvent,
  logWriter: Logger
) {
  logWriter.writeLine('Update settings event received...');
  purchaseEquipment = eventData.purchaseEquipment ?? false;

  logWriter.writeLine(`  Purchase Equipment : ${purchaseEquipment}`);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Automatic Gang Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const memberNamePrefix = cmdArgs[
    CMG_FLAG_MEMBER_NAME_PREFIX
  ].valueOf() as string;
  purchaseEquipment = cmdArgs[CMD_FLAG_PURCHASE_EQUIPMENT].valueOf() as boolean;

  terminalWriter.writeLine(`New Member Name Prefix : ${memberNamePrefix}`);
  terminalWriter.writeLine(`Purchase Equipment : ${purchaseEquipment}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (!netscript.gang.inGang()) {
    terminalWriter.writeLine(
      'Player not in a gang.  Gang must be created before running this script.'
    );
    return;
  }

  terminalWriter.writeLine('See script logs for on-going gang details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(
    GangsUpdateSettingsEvent,
    handleUpdateSettingsEvent,
    scriptLogWriter
  );

  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    manageGang,
    netscript,
    scriptLogWriter,
    memberNamePrefix
  );
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  return CMD_FLAGS;
}
