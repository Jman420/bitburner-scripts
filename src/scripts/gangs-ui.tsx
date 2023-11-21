import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {eventLoop, initializeScript} from '/scripts/workflows/execution';

import {getReactModel, openTail} from '/scripts/workflows/ui';
import {GangsManagerUI} from '/scripts/ui/gangs-manager-ui';

import {EventListener} from '/scripts/comms/event-comms';

const React = getReactModel().reactNS;

const MODULE_NAME = 'gangs-ui';
const SUBSCRIBER_NAME = 'gangs-ui';

const TAIL_X_POS = 1340;
const TAIL_Y_POS = 18;
const TAIL_WIDTH = 330;
const TAIL_HEIGHT = 200;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Gang Manager UI');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going attack details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  netscript.disableLog('ALL');
  netscript.printRaw(
    <React.StrictMode>
      <GangsManagerUI
        uiTheme={netscript.ui.getTheme()}
        eventListener={eventListener}
      />
    </React.StrictMode>
  );

  await eventLoop(netscript, eventListener);
}
