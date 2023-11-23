import {GangGenInfo, GangOtherInfo, GangOtherInfoObject, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';

import {sendMessage} from '/scripts/comms/event-comms';
import {GangInfoChangedEvent} from '/scripts/comms/events/gang-info-changed-event';
import {GangEnemiesChangedEvent} from '/scripts/comms/events/gang-enemies-changed-event';

import {
  ASCENSION_SCORE_PROPERTIES,
  MemberDetails,
  SKILL_SCORE_PROPERTIES,
  getMemberDetails,
} from '/scripts/workflows/gangs';

const MODULE_NAME = 'gangs-monitor';
const SUBSCRIBER_NAME = 'gangs-monitor';

const UPDATE_DELAY = 1500;

const MONITORED_GANG_INFO_PROPERTIES: Array<keyof GangGenInfo> = [
  'faction',
  'wantedLevelGainRate',
  'wantedLevel',
  'wantedPenalty',
  'moneyGainRate',
];
const MONITORED_GANG_MEMBER_PROPERTIES: Array<keyof MemberDetails> = (
  ASCENSION_SCORE_PROPERTIES as Array<keyof MemberDetails>
)
  .concat(SKILL_SCORE_PROPERTIES)
  .concat(['name', 'ascensionScore', 'earnedRespect', 'skillScore']);
const MONITORED_ENEMIES_INFO_PROPERTIES: Array<keyof GangOtherInfoObject> = [
  'power',
  'territory',
];

let currentGangInfo: GangGenInfo;
let currentGangMembers: MemberDetails[];
let currentEnemiesInfo: GangOtherInfo;
let currentEnemyNames: string[];

async function updateGangDetails(netscript: NS, logWriter: Logger) {
  logWriter.writeLine('Checking for gang metrics changes...');
  const gangInfo = netscript.gang.getGangInformation();
  let gangInfoChanged = false;
  for (
    let monitoredPropertyIndex = 0;
    monitoredPropertyIndex < MONITORED_GANG_INFO_PROPERTIES.length &&
    !gangInfoChanged;
    monitoredPropertyIndex++
  ) {
    const monitoredProperty =
      MONITORED_ENEMIES_INFO_PROPERTIES[monitoredPropertyIndex];
    gangInfoChanged =
      gangInfoChanged ||
      currentGangInfo[monitoredProperty] !== gangInfo[monitoredProperty];
  }

  const gangMembers = getMemberDetails(netscript);
  let gangMembersChanged = currentGangMembers.length !== gangMembers.length;
  for (
    let memberCounter = 0;
    memberCounter < gangMembers.length && !gangMembersChanged;
    memberCounter++
  ) {
    const currentGangMember = currentGangMembers[memberCounter];
    const gangMember = gangMembers[memberCounter];

    for (
      let monitoredPropertyIndex = 0;
      monitoredPropertyIndex < MONITORED_GANG_MEMBER_PROPERTIES.length &&
      !gangMembersChanged;
      monitoredPropertyIndex++
    ) {
      const monitoredProperty =
        MONITORED_GANG_MEMBER_PROPERTIES[monitoredPropertyIndex];
      gangMembersChanged =
        gangMembersChanged ||
        currentGangMember[monitoredProperty] !== gangMember[monitoredProperty];
    }
  }

  if (gangInfoChanged || gangMembersChanged) {
    logWriter.writeLine('Found gang metrics changed.  Sending event...');
    currentGangInfo = gangInfo;
    currentGangMembers = gangMembers;
    sendMessage(new GangInfoChangedEvent(currentGangInfo, currentGangMembers));
  }

  logWriter.writeLine('Checking for enemy gang metrics changes...');
  const enemiesInfo = netscript.gang.getOtherGangInformation();
  const enemyNames = Object.keys(enemiesInfo);
  let enemiesInfoChanged = currentEnemyNames.length !== enemyNames.length;
  for (
    let enemyCounter = 0;
    enemyCounter < enemyNames.length && !enemiesInfoChanged;
    enemyCounter++
  ) {
    const enemyName = enemyNames[enemyCounter];
    const currentEnemy = currentEnemiesInfo[enemyName];
    const enemy = enemiesInfo[enemyName];

    for (
      let monitoredPropertyIndex = 0;
      monitoredPropertyIndex < MONITORED_ENEMIES_INFO_PROPERTIES.length &&
      !enemiesInfoChanged;
      monitoredPropertyIndex++
    ) {
      const monitoredProperty =
        MONITORED_ENEMIES_INFO_PROPERTIES[monitoredPropertyIndex];
      enemiesInfoChanged =
        enemiesInfoChanged ||
        currentEnemy[monitoredProperty] !== enemy[monitoredProperty];
    }
  }

  if (enemiesInfoChanged) {
    logWriter.writeLine('Found enemy gang metrics changed.  Sending event...');
    currentEnemiesInfo = enemiesInfo;
    currentEnemyNames = enemyNames;
    sendMessage(
      new GangEnemiesChangedEvent(currentEnemiesInfo, currentEnemyNames)
    );
  }
  logWriter.writeLine(ENTRY_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  logWriter.writeLine('Gang Monitor & Event Dispatcher');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Initializing & sending initial events...');
  currentGangInfo = netscript.gang.getGangInformation();
  currentGangMembers = getMemberDetails(netscript);
  sendMessage(new GangInfoChangedEvent(currentGangInfo, currentGangMembers));

  currentEnemiesInfo = netscript.gang.getOtherGangInformation();
  currentEnemyNames = Object.keys(currentEnemiesInfo);
  sendMessage(
    new GangEnemiesChangedEvent(currentEnemiesInfo, currentEnemyNames)
  );
  logWriter.writeLine(SECTION_DIVIDER);

  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    updateGangDetails,
    netscript,
    logWriter
  );
}
