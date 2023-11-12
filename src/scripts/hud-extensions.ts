import {AutocompleteData, NS, UserInterfaceTheme} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {HudHooks, getHUD, getHtmlElement} from '/scripts/workflows/ui';
import {StocksTickerEvent} from '/scripts/comms/events/stocks-ticker-event';
import {EventListener} from '/scripts/comms/event-comms';
import {delayedInfiniteLoop} from '/scripts/workflows/execution';
import {TOTAL_STOCKS, runTicker} from '/scripts/workflows/stocks';
import {scanWideNetwork} from '/scripts/workflows/recon';

const CMD_FLAG_EXCLUDE_LOCATION_METRICS = 'excludeLocation';
const CMD_FLAG_EXCLUDE_SCRIPT_METRICS = 'excludeScripts';
const CMD_FLAG_EXCLUDE_STOCK_METRICS = 'excludeStocks';
const CMD_FLAG_EXCLUDE_PLAYER_METRICS = 'excludePlayer';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_EXCLUDE_LOCATION_METRICS, false],
  [CMD_FLAG_EXCLUDE_SCRIPT_METRICS, false],
  [CMD_FLAG_EXCLUDE_STOCK_METRICS, false],
  [CMD_FLAG_EXCLUDE_PLAYER_METRICS, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'hud-extensions';
const SUBSCRIBER_NAME = 'hud-extensions';
const HUD_REFRESH_DELAY = 3000;

const SEPARATOR_CLASS_NAME = 'HUD_sep';
const HUD_ELEMENT_CLASS_NAME = 'HUD_el';
const HUD_LOCATION_METRICS_CLASS_NAME = 'HUD_loc-metrics';
const HUD_CITY_CLASS_NAME = 'HUD_city';
const HUD_LOCATION_CLASS_NAME = 'HUD_loc';
const HUD_SCRIPT_METRICS_CLASS_NAME = 'HUD_scr-metrics';
const HUD_SCRIPT_INCOME_CLASS_NAME = 'HUD_scr-inc';
const HUD_SCRIPT_EXP_CLASS_NAME = 'HUD_scr-exp';
const HUD_STOCK_METRICS_CLASS_NAME = 'HUD_stk-metrics';
const HUD_STOCKS_VALUE_CLASS_NAME = 'HUD_stk-val';
const HUD_STOCKS_PROFIT_CLASS_NAME = 'HUD_stk-prof';
const HUD_PLAYER_METRICS_CLASS_NAME = 'HUD_plr-metrics';
const HUD_KARMA_CLASS_NAME = 'HUD_karma';

class HudExtensions {
  readonly hudHooks: HudHooks;

  readonly uiTheme: UserInterfaceTheme;
  readonly excludeLocationMetrics: boolean;
  readonly excludeScriptMetrics: boolean;
  readonly excludeStockMetrics: boolean;
  readonly excludePlayerMetrics: boolean;

  private cityLabel: HTMLElement;
  private locationLabel: HTMLElement;
  private scriptIncomeLabel: HTMLElement;
  private scriptExpLabel: HTMLElement;
  private stocksValueLabel: HTMLElement;
  private stocksProfitLabel: HTMLElement;
  private karmaLabel: HTMLElement;

  constructor(
    uiTheme: UserInterfaceTheme,
    excludeLocationMetrics = false,
    excludeScriptMetrics = false,
    excludeStockMetrics = false,
    excludePlayerMetrics = false
  ) {
    this.hudHooks = getHUD();
    if (!this.hudHooks.labelsElement || !this.hudHooks.valuesElement) {
      throw new Error('Unable to find HUD Hook Elements.');
    }

    this.uiTheme = uiTheme;
    this.excludeLocationMetrics = excludeLocationMetrics;
    this.excludeScriptMetrics = excludeScriptMetrics;
    this.excludeStockMetrics = excludeStockMetrics;
    this.excludePlayerMetrics = excludePlayerMetrics;

    this.addNewSeparator();
    this.cityLabel = this.addNewHudRow(
      'City',
      'Name of the city you are currently in.',
      this.excludeLocationMetrics,
      HUD_LOCATION_METRICS_CLASS_NAME,
      HUD_CITY_CLASS_NAME
    );
    this.locationLabel = this.addNewHudRow(
      'Location',
      'Current location witin the city.',
      this.excludeLocationMetrics,
      HUD_LOCATION_METRICS_CLASS_NAME,
      HUD_LOCATION_CLASS_NAME
    );
    this.scriptIncomeLabel = this.addNewHudRow(
      'Script Income',
      'Script income per second',
      this.excludeScriptMetrics,
      HUD_SCRIPT_METRICS_CLASS_NAME,
      HUD_SCRIPT_INCOME_CLASS_NAME
    );
    this.scriptExpLabel = this.addNewHudRow(
      'Script Exp',
      'Script hacking experience per second',
      this.excludeScriptMetrics,
      HUD_SCRIPT_METRICS_CLASS_NAME,
      HUD_SCRIPT_EXP_CLASS_NAME
    );
    this.stocksValueLabel = this.addNewHudRow(
      'Stocks Value',
      'Total value of stock portfolio',
      this.excludeStockMetrics,
      HUD_STOCK_METRICS_CLASS_NAME,
      HUD_STOCKS_VALUE_CLASS_NAME
    );
    this.stocksProfitLabel = this.addNewHudRow(
      'Stocks Profit',
      'Total profit from stock portfolio',
      this.excludeStockMetrics,
      HUD_STOCK_METRICS_CLASS_NAME,
      HUD_STOCKS_PROFIT_CLASS_NAME
    );
    this.karmaLabel = this.addNewHudRow(
      'Karma',
      'Player karma level',
      this.excludePlayerMetrics,
      HUD_PLAYER_METRICS_CLASS_NAME,
      HUD_KARMA_CLASS_NAME
    );
  }

  public shutdown() {
    if (this.hudHooks.labelsElement) {
      for (const element of this.hudHooks.labelsElement.children) {
        this.hudHooks.labelsElement.removeChild(element);
      }
    }
    if (this.hudHooks.valuesElement) {
      for (const element of this.hudHooks.valuesElement.children) {
        this.hudHooks.valuesElement.removeChild(element);
      }
    }
  }

  public setCity(value: string) {
    this.setTextValue(this.cityLabel, value);
  }

  public setLocation(value: string) {
    this.setTextValue(this.locationLabel, value);
  }

  public setScriptIncome(value: string) {
    this.setTextValue(this.scriptIncomeLabel, value);
  }

  public setScriptExp(value: string) {
    this.setTextValue(this.scriptExpLabel, value);
  }

  public setStocksValue(value: string) {
    this.setTextValue(this.stocksValueLabel, value);
  }

  public setStocksProfit(value: string) {
    this.setTextValue(this.stocksProfitLabel, value);
  }

  public setKarma(value: string) {
    this.setTextValue(this.karmaLabel, value);
  }

  private setTextValue(element: HTMLElement, value: string) {
    element.innerText = value;
  }

  private addNewSeparator() {
    const newElement = getHtmlElement('hr');
    newElement.classList.add(SEPARATOR_CLASS_NAME, HUD_ELEMENT_CLASS_NAME);
    this.hudHooks.labelsElement?.appendChild(newElement);
    this.hudHooks.valuesElement?.appendChild(newElement);
    return newElement;
  }

  private addNewHudRow(
    text = '',
    hoverText = '',
    hidden = false,
    ...classNames: string[]
  ) {
    if (!classNames.includes(HUD_ELEMENT_CLASS_NAME)) {
      classNames.push(HUD_ELEMENT_CLASS_NAME);
    }

    const textElement = getHtmlElement();
    textElement.innerText = text;
    textElement.title = hoverText;
    textElement.style.display = hidden ? 'none' : textElement.style.display;
    textElement.classList.add(...classNames);
    this.hudHooks.labelsElement?.appendChild(textElement);

    const valueElement = getHtmlElement();
    valueElement.classList.add(...classNames);
    this.hudHooks.valuesElement?.appendChild(valueElement);

    return valueElement;
  }
}

function updatePolledMetrics(
  netscript: NS,
  logWriter: Logger,
  hudExtensions: HudExtensions
) {
  logWriter.writeLine('Calculating script metrics...');
  let totalScriptIncome = 0;
  let totalScriptExp = 0;
  const rootedHosts = scanWideNetwork(netscript, true, true, true);
  for (const hostname of rootedHosts) {
    const procInfos = netscript.ps(hostname);
    for (const scriptProc of procInfos) {
      const scriptDetails = netscript.getRunningScript(
        scriptProc.pid,
        hostname
      );
      if (scriptDetails) {
        totalScriptIncome +=
          scriptDetails.onlineMoneyMade / scriptDetails.onlineRunningTime;
        totalScriptExp +=
          scriptDetails.onlineExpGained / scriptDetails.onlineRunningTime;
      }
    }
  }

  logWriter.writeLine('Retrieving location & player metrics...');
  const playerInfo = netscript.getPlayer();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const karma = (netscript as any).heart.break();

  logWriter.writeLine('Updating location, script & player metrics...');
  hudExtensions.setCity(playerInfo.city);
  hudExtensions.setLocation(playerInfo.location);
  hudExtensions.setScriptIncome(netscript.formatNumber(totalScriptIncome));
  hudExtensions.setScriptExp(netscript.formatNumber(totalScriptExp));
  hudExtensions.setKarma(netscript.formatNumber(karma));
  logWriter.writeLine(ENTRY_DIVIDER);
}

function updateStockMetrics(
  eventData: StocksTickerEvent,
  netscript: NS,
  logWriter: Logger,
  hudExtensions: HudExtensions
) {
  if (
    !eventData.stockListings ||
    eventData.stockListings.length < TOTAL_STOCKS
  ) {
    return;
  }

  logWriter.writeLine('Calculating stock portfolio metrics...');
  let totalValue = 0;
  let totalProfit = 0;
  for (const stockListing of eventData.stockListings) {
    const longValue = stockListing.position.longShares * stockListing.askPrice;
    const shortValue =
      stockListing.position.shortShares * stockListing.bidPrice;
    totalValue += longValue;
    totalValue += shortValue;

    totalProfit +=
      longValue -
      stockListing.position.longShares * stockListing.position.longPrice;
    totalProfit +=
      shortValue -
      stockListing.position.shortShares * stockListing.position.shortPrice;
  }

  logWriter.writeLine('Updating stock portfolio metrics...');
  hudExtensions.setStocksValue(netscript.formatNumber(totalValue));
  hudExtensions.setStocksProfit(netscript.formatNumber(totalProfit));
  logWriter.writeLine(ENTRY_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
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
  terminalWriter.writeLine(`Exclude Stock Metrics : ${excludeStockMetrics}`);
  terminalWriter.writeLine(`Exclude Player Metrics : ${excludePlayerMetrics}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (
    excludeLocationMetrics &&
    excludeScriptMetrics &&
    excludeStockMetrics &&
    excludePlayerMetrics
  ) {
    terminalWriter.writeLine(
      'All HUD extension disabled.  No UI to render or update.'
    );
    return;
  }

  if (!excludeStockMetrics && !runTicker(netscript)) {
    terminalWriter.writeLine(
      'Failed to find or execute a Stock Forecasting script!'
    );
    return;
  }

  const uiTheme = netscript.ui.getTheme();
  const hudExtensions = new HudExtensions(
    uiTheme,
    excludeLocationMetrics,
    excludeScriptMetrics,
    excludeStockMetrics,
    excludePlayerMetrics
  );
  netscript.atExit(() => hudExtensions.shutdown());

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const eventListener = new EventListener(netscript, SUBSCRIBER_NAME);
  eventListener.addListener(
    StocksTickerEvent,
    updateStockMetrics,
    netscript,
    scriptLogWriter,
    hudExtensions
  );

  await delayedInfiniteLoop(
    netscript,
    HUD_REFRESH_DELAY,
    updatePolledMetrics,
    netscript,
    scriptLogWriter,
    hudExtensions
  );
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  return CMD_FLAGS;
}
