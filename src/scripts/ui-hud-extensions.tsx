import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {HudHooks, getHudHooks, getReactModel} from '/scripts/workflows/ui';
import {
  ensureRunning,
  eventLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {runStockTicker} from '/scripts/workflows/stocks';
import {GANGS_MONITOR_SCRIPT} from '/scripts/workflows/gangs';

import {CustomHudLabels} from '/scripts/controls/custom-hud-labels';
import {CustomHudValues} from '/scripts/controls/custom-hud-values';

import {EventListener} from '/scripts/comms/event-comms';
import {ExitEvent} from '/scripts/comms/events/exit-event';

const reactModel = getReactModel();
const React = reactModel.reactNS;

const CMD_FLAG_EXCLUDE_LOCATION_METRICS = 'excludeLocation';
const CMD_FLAG_EXCLUDE_SCRIPT_METRICS = 'excludeScripts';
const CMD_FLAG_EXCLUDE_GANG_METRICS = 'excludeGang';
const CMD_FLAG_EXCLUDE_STOCK_METRICS = 'excludeStocks';
const CMD_FLAG_EXCLUDE_PLAYER_METRICS = 'excludePlayer';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_EXCLUDE_LOCATION_METRICS, false],
  [CMD_FLAG_EXCLUDE_SCRIPT_METRICS, false],
  [CMD_FLAG_EXCLUDE_STOCK_METRICS, false],
  [CMD_FLAG_EXCLUDE_GANG_METRICS, false],
  [CMD_FLAG_EXCLUDE_PLAYER_METRICS, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'ui-hud-extensions';
const SUBSCRIBER_NAME = 'ui-hud-extensions';
const HUD_REFRESH_DELAY = 3000;

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function handleShutdown(eventData: ExitEvent, hudHooks: HudHooks) {
  if (hudHooks.labelsElement) {
    reactModel.reactDOM.render(<div />, hudHooks.labelsElement);
  }
  if (hudHooks.valuesElement) {
    reactModel.reactDOM.render(<div />, hudHooks.valuesElement);
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('HUD Extensions Refresh Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const excludeLocationMetrics = cmdArgs[
    CMD_FLAG_EXCLUDE_LOCATION_METRICS
  ].valueOf() as boolean;
  const excludeScriptMetrics = cmdArgs[
    CMD_FLAG_EXCLUDE_SCRIPT_METRICS
  ].valueOf() as boolean;
  const excludeGangMetrics = cmdArgs[
    CMD_FLAG_EXCLUDE_GANG_METRICS
  ].valueOf() as boolean;
  const excludeStockMetrics = cmdArgs[
    CMD_FLAG_EXCLUDE_STOCK_METRICS
  ].valueOf() as boolean;
  const excludePlayerMetrics = cmdArgs[
    CMD_FLAG_EXCLUDE_PLAYER_METRICS
  ].valueOf() as boolean;

  terminalWriter.writeLine(
    `Exclude Location Metrics : ${excludeLocationMetrics}`
  );
  terminalWriter.writeLine(`Exclude Script Metrics : ${excludeScriptMetrics}`);
  terminalWriter.writeLine(`Exclude Gang Metrics: ${excludeGangMetrics}`);
  terminalWriter.writeLine(`Exclude Stock Metrics : ${excludeStockMetrics}`);
  terminalWriter.writeLine(`Exclude Player Metrics : ${excludePlayerMetrics}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (
    excludeLocationMetrics &&
    excludeScriptMetrics &&
    excludeStockMetrics &&
    excludeGangMetrics
  ) {
    terminalWriter.writeLine(
      'All HUD extension disabled.  No UI to render or update.'
    );
    return;
  }

  const hudHooks = getHudHooks();
  if (
    !hudHooks.labelsElement ||
    !hudHooks.valuesElement ||
    !hudHooks.extrasElement
  ) {
    terminalWriter.writeLine('Unable to obtain HUD Hooks.');
    return;
  }

  if (!excludeStockMetrics && !runStockTicker(netscript)) {
    terminalWriter.writeLine(
      'Failed to find or execute a Stock Forecasting script!'
    );
    return;
  }
  if (!excludeGangMetrics && !ensureRunning(netscript, GANGS_MONITOR_SCRIPT)) {
    terminalWriter.writeLine(
      'Failed to find or execute a Gang Monitor script!'
    );
    return;
  }

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(ExitEvent, handleShutdown, hudHooks);

  reactModel.reactDOM.render(
    <React.StrictMode>
      <CustomHudLabels
        uiTheme={netscript.ui.getTheme()}
        excludeLocationMetrics={excludeLocationMetrics}
        excludeScriptsMetrics={excludeScriptMetrics}
        excludeStocksMetrics={excludeStockMetrics}
        excludeGangMetrics={excludeGangMetrics}
        excludePlayerMetrics={excludePlayerMetrics}
      />
    </React.StrictMode>,
    hudHooks.labelsElement
  );
  reactModel.reactDOM.render(
    <React.StrictMode>
      <CustomHudValues
        netscript={netscript}
        eventListener={eventListener}
        logWriter={scriptLogWriter}
        updateDelay={HUD_REFRESH_DELAY}
        uiTheme={netscript.ui.getTheme()}
        excludeLocationMetrics={excludeLocationMetrics}
        excludeScriptsMetrics={excludeScriptMetrics}
        excludeStocksMetrics={excludeStockMetrics}
        excludeGangMetrics={excludeGangMetrics}
        excludePlayerMetrics={excludePlayerMetrics}
      />
    </React.StrictMode>,
    hudHooks.valuesElement
  );

  await eventLoop(netscript, eventListener);
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  return CMD_FLAGS;
}
