import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  eventLoop,
  getPid,
  initializeScript,
} from '/scripts/workflows/execution';

import {getReactModel, openTail} from '/scripts/workflows/ui';

import {EventListener} from '/scripts/comms/event-comms';
import {
  AttackManagerRunning,
  WgwhManagerUI,
} from '/scripts/controls/wgwh-manager-ui';
import {
  BATCH_ATTACK_SCRIPT,
  SERIAL_ATTACK_SCRIPT,
} from '/scripts/workflows/attacks';

const React = getReactModel().reactNS;

const MODULE_NAME = 'ui-wgwh';
const SUBSCRIBER_NAME = 'ui-wgwh';

const TAIL_X_POS = 645;
const TAIL_Y_POS = 154;
const TAIL_WIDTH = 400;
const TAIL_HEIGHT = 435;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('WeakenGrow WeakenHack Attack UI');
  terminalWriter.writeLine(SECTION_DIVIDER);

  netscript.disableLog('ALL');
  const serialAttackRunning = getPid(netscript, SERIAL_ATTACK_SCRIPT);
  const batchAttackRunning = getPid(netscript, BATCH_ATTACK_SCRIPT);
  let attackManagerRunning = AttackManagerRunning.NONE;
  if (serialAttackRunning && batchAttackRunning) {
    terminalWriter.writeLine(
      'Unable to control both Serial & Batch Attack Managers at once.  Please stop one of the attack scripts.'
    );
    return;
  }
  if (serialAttackRunning) {
    attackManagerRunning = AttackManagerRunning.SERIAL;
  } else if (batchAttackRunning) {
    attackManagerRunning = AttackManagerRunning.BATCH;
  }

  terminalWriter.writeLine('See script logs for on-going attack details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  netscript.printRaw(
    <React.StrictMode>
      <WgwhManagerUI
        netscript={netscript}
        eventListener={eventListener}
        attackManagerRunning={attackManagerRunning}
      />
    </React.StrictMode>
  );

  await eventLoop(netscript, eventListener);
}
