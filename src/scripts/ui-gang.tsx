import {NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  ensureRunning,
  eventLoop,
  initializeScript,
} from '/scripts/workflows/execution';

import {getReactModel, openTail} from '/scripts/workflows/ui';
import {GangsManagerUI} from '/scripts/ui/gang-manager-ui';

import {EventListener} from '/scripts/comms/event-comms';

const React = getReactModel().reactNS;

const MODULE_NAME = 'ui-gang';
const SUBSCRIBER_NAME = 'ui-gang';

const TAIL_X_POS = 1340;
const TAIL_Y_POS = 18;
const TAIL_WIDTH = 330;
const TAIL_HEIGHT = 235;

const GANGS_MANAGER_SCRIPT = '/scripts/gang-manager.js';

function runGangManager(
  netscript: NS,
  logWriter: Logger,
  scriptRunning: boolean
) {
  if (!scriptRunning && !ensureRunning(netscript, GANGS_MANAGER_SCRIPT)) {
    logWriter.writeLine('Failed to find or execute the Gang Manager script!');
  } else if (scriptRunning) {
    netscript.scriptKill(GANGS_MANAGER_SCRIPT, netscript.getHostname());
  }
}

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
        runManagerCallback={runGangManager.bind(
          undefined,
          netscript,
          terminalWriter
        )}
      />
    </React.StrictMode>
  );

  await eventLoop(netscript, eventListener);
}
