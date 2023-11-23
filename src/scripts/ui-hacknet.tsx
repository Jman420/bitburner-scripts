import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {eventLoop, initializeScript} from '/scripts/workflows/execution';

import {getReactModel, openTail} from '/scripts/workflows/ui';
import {HacknetManagerUI} from '/scripts/controls/hacknet-manager-ui';

import {EventListener} from '/scripts/comms/event-comms';

const React = getReactModel().reactNS;

const MODULE_NAME = 'ui-hacknet';
const SUBSCRIBER_NAME = 'ui-hacknet';

const TAIL_X_POS = 1320;
const TAIL_Y_POS = 52;
const TAIL_WIDTH = 330;
const TAIL_HEIGHT = 245;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Hacknet Manager UI');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going purchase details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  netscript.disableLog('ALL');
  netscript.printRaw(
    <React.StrictMode>
      <HacknetManagerUI netscript={netscript} eventListener={eventListener} />
    </React.StrictMode>
  );

  await eventLoop(netscript, eventListener);
}
