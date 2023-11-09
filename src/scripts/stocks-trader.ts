import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {eventLoop, runScript} from '/scripts/workflows/execution';
import {
  FIFTY_PERCENT,
  STOCK_FORECAST_4SIGMA_SCRIPT,
  STOCK_FORECAST_HISTORY_SCRIPT,
  buyStock,
  getAllStockListings,
  sellStock,
} from '/scripts/workflows/stocks';

import {EventListener} from '/scripts/comms/event-comms';
import {StocksUpdatedEvent} from '/scripts/comms/messages/stocks-updated-event';
import {HOME_SERVER_NAME} from '/scripts/common/shared';

const CMD_FLAG_FUNDS_LIMIT = 'fundsLimit';
const CMD_FLAG_ENABLE_SHORT_SALES = 'enableShort';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_FUNDS_LIMIT, 0.75],
  [CMD_FLAG_ENABLE_SHORT_SALES, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const SUBSCRIBER_NAME = 'stocks-trader';
const PURCHASE_FORECAST_MARGIN = 0.05;

function tradeStocks(
  netscript: NS,
  logWriter: Logger,
  fundsLimit: number,
  shortEnabled = false,
  eventData?: StocksUpdatedEvent
) {
  const updatedSymbols = eventData?.updatedStockSymbols ?? [];
  logWriter.writeLine(
    `Received Stock Listings Updated Event with ${updatedSymbols.length} updated listings`
  );
  if (updatedSymbols.length < 1) {
    logWriter.writeLine(
      'No symbols included in event data.  Skipping trading logic.'
    );
    logWriter.writeLine(SECTION_DIVIDER);
    return;
  }

  logWriter.writeLine('  Retrieving updated stock listings...');
  const stockListings = getAllStockListings()
    .filter(stockListing => updatedSymbols.includes(stockListing.symbol))
    .sort((stockA, stockB) => stockB.forecastScore - stockA.forecastScore);

  logWriter.writeLine('  Handling sell transactions...');
  let totalSaleProfits = 0;
  const soldStocks = new Array<string>();
  for (const stockDetails of stockListings) {
    if (
      stockDetails.position.longShares > 0 &&
      stockDetails.forecast > FIFTY_PERCENT
    ) {
      totalSaleProfits += sellStock(
        stockDetails.symbol,
        stockDetails.position.longShares,
        stockDetails.position.longPrice,
        netscript.stock.sellStock
      );
      soldStocks.push(stockDetails.symbol);
    } else if (
      stockDetails.position.shortShares > 0 &&
      stockDetails.forecast < FIFTY_PERCENT
    ) {
      totalSaleProfits += sellStock(
        stockDetails.symbol,
        stockDetails.position.shortShares,
        stockDetails.position.shortPrice,
        netscript.stock.sellShort
      );
      soldStocks.push(stockDetails.symbol);
    }
  }
  logWriter.writeLine(
    `  Sold ${soldStocks.length} stocks for $${netscript.formatNumber(
      totalSaleProfits
    )} profit`
  );

  logWriter.writeLine('  Handling purchase transactions...');
  let playerMoney = netscript.getServerMoneyAvailable(HOME_SERVER_NAME);
  let totalPurchaseCosts = 0;
  const purchasedStocks = new Array<string>();
  for (
    let stockCounter = 0;
    stockCounter < stockListings.length && playerMoney > fundsLimit;
    stockCounter++
  ) {
    const stockDetails = stockListings[stockCounter];
    if (stockDetails.forecast > FIFTY_PERCENT + PURCHASE_FORECAST_MARGIN) {
      totalPurchaseCosts += buyStock(
        stockDetails.symbol,
        stockDetails.askPrice,
        stockDetails.maxShares,
        playerMoney,
        netscript.stock.buyStock
      );
      purchasedStocks.push(stockDetails.symbol);
    } else if (
      stockDetails.forecast < FIFTY_PERCENT - PURCHASE_FORECAST_MARGIN &&
      shortEnabled
    ) {
      totalPurchaseCosts += buyStock(
        stockDetails.symbol,
        stockDetails.bidPrice,
        stockDetails.maxShares,
        playerMoney,
        netscript.stock.buyShort
      );
      purchasedStocks.push(stockDetails.symbol);
    }

    playerMoney = netscript.getServerMoneyAvailable(HOME_SERVER_NAME);
  }
  logWriter.writeLine(
    `  Purchased ${purchasedStocks.length} stocks for $${netscript.formatNumber(
      totalPurchaseCosts
    )} cost`
  );
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'stocks-trader', LoggerMode.TERMINAL);
  logWriter.writeLine('Stock Market Grow-Hack Manager');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const fundsLimitPercent = cmdArgs[CMD_FLAG_FUNDS_LIMIT].valueOf() as number;
  const shortEnabled = cmdArgs[
    CMD_FLAG_ENABLE_SHORT_SALES
  ].valueOf() as boolean;

  logWriter.writeLine(
    `Funds Limit Percent : ${netscript.formatPercent(fundsLimitPercent)}`
  );
  logWriter.writeLine(SECTION_DIVIDER);

  if (!netscript.stock.hasWSEAccount() || !netscript.stock.hasTIXAPIAccess()) {
    logWriter.writeLine(
      'Script needs World Stock Exchange account and API access to trade stocks!'
    );
    return;
  }

  let stockForecastPid = -1;
  if (
    !netscript.isRunning(STOCK_FORECAST_HISTORY_SCRIPT) &&
    !netscript.isRunning(STOCK_FORECAST_4SIGMA_SCRIPT)
  ) {
    if (netscript.stock.has4SDataTIXAPI()) {
      stockForecastPid = runScript(
        netscript,
        STOCK_FORECAST_4SIGMA_SCRIPT,
        netscript.getHostname()
      );
    } else {
      stockForecastPid = runScript(
        netscript,
        STOCK_FORECAST_HISTORY_SCRIPT,
        netscript.getHostname()
      );
    }
  }

  if (!stockForecastPid) {
    logWriter.writeLine(
      'Failed to find or execute a Stock Forecasting script!'
    );
    return;
  }

  const fundsLimit =
    netscript.getServerMoneyAvailable(HOME_SERVER_NAME) * fundsLimitPercent;
  const eventListener = new EventListener(netscript, SUBSCRIBER_NAME);
  eventListener.addListeners(
    StocksUpdatedEvent,
    tradeStocks.bind(undefined, netscript, logWriter, fundsLimit, shortEnabled)
  );
  eventLoop(netscript, eventListener);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
