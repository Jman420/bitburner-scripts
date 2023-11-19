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
import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {TOTAL_STOCKS, runStockTicker} from '/scripts/workflows/stocks';
import {scanWideNetwork} from '/scripts/workflows/recon';
import {ExitEvent} from '/scripts/comms/events/exit-event';
import {GangInfoChangedEvent} from '/scripts/comms/events/gang-info-changed-event';

const CMD_FLAG_EXCLUDE_LOCATION_METRICS = 'excludeLocation';
const CMD_FLAG_EXCLUDE_SCRIPT_METRICS = 'excludeScripts';
const CMD_FLAG_EXCLUDE_STOCK_METRICS = 'excludeStocks';
const CMD_FLAG_EXCLUDE_GANG_METRICS = 'excludeGang';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_EXCLUDE_LOCATION_METRICS, false],
  [CMD_FLAG_EXCLUDE_SCRIPT_METRICS, false],
  [CMD_FLAG_EXCLUDE_STOCK_METRICS, false],
  [CMD_FLAG_EXCLUDE_GANG_METRICS, false],
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
const HUD_GANG_METRICS_CLASS_NAME = 'HUD_gang-metrics';
const HUD_GANG_INCOME_CLASS_NAME = 'HUD_gang-inc';
const HUD_GANG_BUY_AUGMENTATIONS_CLASS_NAME = 'HUD_gang-buy-augs';
const HUD_GANG_BUY_EQUIPMENT_CLASS_NAME = 'HUD_gang-buy-gear';

class HudExtensions {
  readonly hudHooks: HudHooks;

  readonly uiTheme: UserInterfaceTheme;
  readonly excludeLocationMetrics: boolean;
  readonly excludeScriptMetrics: boolean;
  readonly excludeStockMetrics: boolean;
  readonly excludeGangMetrics: boolean;

  private cityLabel: HTMLElement;
  private locationLabel: HTMLElement;
  private scriptIncomeLabel: HTMLElement;
  private scriptExpLabel: HTMLElement;
  private stocksValueLabel: HTMLElement;
  private stocksProfitLabel: HTMLElement;
  private gangIncomeLabel: HTMLElement;

  constructor(
    uiTheme: UserInterfaceTheme,
    excludeLocationMetrics = false,
    excludeScriptMetrics = false,
    excludeStockMetrics = false,
    excludeGangMetrics = false
  ) {
    this.hudHooks = getHUD();
    if (!this.hudHooks.labelsElement || !this.hudHooks.valuesElement) {
      throw new Error('Unable to find HUD Hook Elements.');
    }

    this.uiTheme = uiTheme;
    this.excludeLocationMetrics = excludeLocationMetrics;
    this.excludeScriptMetrics = excludeScriptMetrics;
    this.excludeStockMetrics = excludeStockMetrics;
    this.excludeGangMetrics = excludeGangMetrics;

    this.addNewSeparator();
    this.cityLabel = this.addNewHudRow(
      'City',
      'Name of the city you are currently in.',
      this.uiTheme['infolight'],
      this.excludeLocationMetrics,
      HUD_LOCATION_METRICS_CLASS_NAME,
      HUD_CITY_CLASS_NAME
    );
    this.locationLabel = this.addNewHudRow(
      'Location',
      'Current location witin the city.',
      this.uiTheme['infolight'],
      this.excludeLocationMetrics,
      HUD_LOCATION_METRICS_CLASS_NAME,
      HUD_LOCATION_CLASS_NAME
    );
    this.scriptExpLabel = this.addNewHudRow(
      'Script Exp',
      'Script hacking experience per second',
      this.uiTheme['hack'],
      this.excludeScriptMetrics,
      HUD_SCRIPT_METRICS_CLASS_NAME,
      HUD_SCRIPT_EXP_CLASS_NAME
    );
    this.scriptIncomeLabel = this.addNewHudRow(
      'Script Inc',
      'Script income per second',
      this.uiTheme['money'],
      this.excludeScriptMetrics,
      HUD_SCRIPT_METRICS_CLASS_NAME,
      HUD_SCRIPT_INCOME_CLASS_NAME
    );
    this.stocksValueLabel = this.addNewHudRow(
      'Stocks Val',
      'Total value of stock portfolio',
      this.uiTheme['money'],
      this.excludeStockMetrics,
      HUD_STOCK_METRICS_CLASS_NAME,
      HUD_STOCKS_VALUE_CLASS_NAME
    );
    this.stocksProfitLabel = this.addNewHudRow(
      'Stocks Pft',
      'Total profit from stock portfolio',
      this.uiTheme['money'],
      this.excludeStockMetrics,
      HUD_STOCK_METRICS_CLASS_NAME,
      HUD_STOCKS_PROFIT_CLASS_NAME
    );
    this.gangIncomeLabel = this.addNewHudRow(
      'Gang Inc',
      'Gang income per second',
      this.uiTheme['money'],
      this.excludeGangMetrics,
      HUD_GANG_METRICS_CLASS_NAME,
      HUD_GANG_INCOME_CLASS_NAME
    );
  }

  public setCity(value: string) {
    this.setTextValue(this.cityLabel, value);
  }

  public setLocation(value: string) {
    this.setTextValue(this.locationLabel, value);
  }

  public setScriptIncome(value: string) {
    if (value.at(0) !== '$') {
      value = `$${value}`;
    }
    this.setTextValue(this.scriptIncomeLabel, value);
  }

  public setScriptExp(value: string) {
    this.setTextValue(this.scriptExpLabel, value);
  }

  public setStocksValue(value: string) {
    if (value.at(0) !== '$') {
      value = `$${value}`;
    }
    this.setTextValue(this.stocksValueLabel, value);
  }

  public setStocksProfit(value: string) {
    if (value.at(0) !== '$') {
      value = `$${value}`;
    }
    this.setTextValue(this.stocksProfitLabel, value);
  }

  public setGangIncome(value: string) {
    if (value.at(0) !== '$') {
      value = `$${value}`;
    }
    this.setTextValue(this.gangIncomeLabel, value);
  }

  private setTextValue(element: HTMLElement, value: string) {
    element.innerText = value;
  }

  private addNewSeparator() {
    const labelSeparator = getHtmlElement('hr');
    labelSeparator.classList.add(SEPARATOR_CLASS_NAME, HUD_ELEMENT_CLASS_NAME);
    this.hudHooks.labelsElement?.appendChild(labelSeparator);

    const valueSeparator = getHtmlElement('hr');
    valueSeparator.classList.add(SEPARATOR_CLASS_NAME, HUD_ELEMENT_CLASS_NAME);
    this.hudHooks.valuesElement?.appendChild(valueSeparator);
    return labelSeparator;
  }

  private addNewHudRow(
    text = '',
    hoverText = '',
    color = '',
    hidden = false,
    ...classNames: string[]
  ) {
    if (!classNames.includes(HUD_ELEMENT_CLASS_NAME)) {
      classNames.push(HUD_ELEMENT_CLASS_NAME);
    }

    const textElement = getHtmlElement();
    const displayState = hidden ? 'none' : '';
    textElement.innerText = text;
    textElement.title = hoverText;
    textElement.style.display = displayState;
    textElement.style.color = color;
    textElement.classList.add(...classNames);
    this.hudHooks.labelsElement?.appendChild(textElement);

    const labelLineBreak = getHtmlElement('br');
    labelLineBreak.style.display = displayState;
    labelLineBreak.classList.add(HUD_ELEMENT_CLASS_NAME);
    this.hudHooks.labelsElement?.appendChild(labelLineBreak);

    const valueElement = getHtmlElement();
    valueElement.style.display = displayState;
    valueElement.style.color = color;
    valueElement.classList.add(...classNames);
    this.hudHooks.valuesElement?.appendChild(valueElement);

    const valueLineBreak = getHtmlElement('br');
    valueLineBreak.style.display = displayState;
    labelLineBreak.classList.add(HUD_ELEMENT_CLASS_NAME);
    this.hudHooks.valuesElement?.appendChild(valueLineBreak);

    return valueElement;
  }

  public shutdown() {
    if (this.hudHooks.labelsElement) {
      while (this.hudHooks.labelsElement.firstChild) {
        this.hudHooks.labelsElement.removeChild(
          this.hudHooks.labelsElement.firstChild
        );
      }
    }
    if (this.hudHooks.valuesElement) {
      while (this.hudHooks.valuesElement.firstChild) {
        this.hudHooks.valuesElement.removeChild(
          this.hudHooks.valuesElement.firstChild
        );
      }
    }
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

  logWriter.writeLine('Updating location, script & player metrics...');
  hudExtensions.setCity(playerInfo.city);
  hudExtensions.setLocation(playerInfo.location);
  hudExtensions.setScriptIncome(netscript.formatNumber(totalScriptIncome));
  hudExtensions.setScriptExp(netscript.formatNumber(totalScriptExp));
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

function updateGangMetrics(
  eventData: GangInfoChangedEvent,
  netscript: NS,
  logWriter: Logger,
  hudExtensions: HudExtensions
) {
  if (!eventData.gangInfo) {
    return;
  }

  logWriter.writeLine('Updating gang metrics...');
  hudExtensions.setGangIncome(
    netscript.formatNumber(eventData.gangInfo.moneyGainRate)
  );
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
  const excludeStockMetrics = cmdArgs[
    CMD_FLAG_EXCLUDE_STOCK_METRICS
  ].valueOf() as boolean;
  const excludeGangMetrics = cmdArgs[
    CMD_FLAG_EXCLUDE_GANG_METRICS
  ].valueOf() as boolean;

  terminalWriter.writeLine(
    `Exclude Location Metrics : ${excludeLocationMetrics}`
  );
  terminalWriter.writeLine(`Exclude Script Metrics : ${excludeScriptMetrics}`);
  terminalWriter.writeLine(`Exclude Stock Metrics : ${excludeStockMetrics}`);
  terminalWriter.writeLine(`Exclude Gang Metrics: ${excludeGangMetrics}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (excludeLocationMetrics && excludeScriptMetrics && excludeStockMetrics) {
    terminalWriter.writeLine(
      'All HUD extension disabled.  No UI to render or update.'
    );
    return;
  }

  if (!excludeStockMetrics && !runStockTicker(netscript)) {
    terminalWriter.writeLine(
      'Failed to find or execute a Stock Forecasting script!'
    );
  }

  const uiTheme = netscript.ui.getTheme();
  const hudExtensions = new HudExtensions(
    uiTheme,
    excludeLocationMetrics,
    excludeScriptMetrics,
    excludeStockMetrics,
    excludeGangMetrics
  );

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(
    ExitEvent,
    hudExtensions.shutdown.bind(hudExtensions)
  );
  eventListener.addListener(
    StocksTickerEvent,
    updateStockMetrics,
    netscript,
    scriptLogWriter,
    hudExtensions
  );
  eventListener.addListener(
    GangInfoChangedEvent,
    updateGangMetrics,
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
