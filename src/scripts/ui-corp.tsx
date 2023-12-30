import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {eventLoop, initializeScript} from '/scripts/workflows/execution';

import {getReactModel, openTail} from '/scripts/workflows/ui';

import {EventListener} from '/scripts/comms/event-comms';
import {CorporationUI} from '/scripts/controls/corporation-ui';

const React = getReactModel().reactNS;

const MODULE_NAME = 'ui-corp';
const SUBSCRIBER_NAME = 'ui-corp';

const TAIL_X_POS = 1837;
const TAIL_Y_POS = 60;
const TAIL_WIDTH = 505;
const TAIL_HEIGHT = 710;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporation Automation UI');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script log window for user interface.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  netscript.disableLog('ALL');
  netscript.printRaw(
    <React.StrictMode>
      <CorporationUI netscript={netscript} eventListener={eventListener} />
    </React.StrictMode>
  );

  await eventLoop(netscript, eventListener);
}
