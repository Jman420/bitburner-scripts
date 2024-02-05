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

import {HOME_SERVER_NAME, SCRIPTS_DIR} from '/scripts/common/shared';

import {eventLoop, initializeScript} from '/scripts/workflows/execution';
import {
  COMMISSION,
  FIFTY_PERCENT,
  PurchaseTransaction,
  SaleTransaction,
  StocksTraderConfig,
  TransactionPosition,
  buyPosition,
  runStockTicker,
  sellPosition,
} from '/scripts/workflows/stocks';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {StocksTickerEvent} from '/scripts/comms/events/stocks-ticker-event';
import {StocksSoldEvent} from '/scripts/comms/events/stocks-sold-event';
import {StocksPurchasedEvent} from '/scripts/comms/events/stocks-purchased-event';
import {StockListingsResponse} from '/scripts/comms/responses/stocks-listing-response';
import {StockListingsRequest} from '/scripts/comms/requests/stocks-listing-request';

import {TerminalLogger} from '/scripts/logging/terminalLogger';
import {ScriptLogger} from '/scripts/logging/scriptLogger';
import {openTail} from '/scripts/workflows/ui';
import {StocksTraderConfigEvent} from '/scripts/comms/events/stocks-trader-config-event';
import {StocksTraderConfigRequest} from '/scripts/comms/requests/stocks-trader-config-request';
import {StocksTraderConfigResponse} from '/scripts/comms/responses/stocks-trader-config-response';
import {
  NetscriptPackage,
  getGhostPackage,
} from '/scripts/netscript-services/netscript-ghost';

export const STOCKS_TRADER_SCRIPT = `${SCRIPTS_DIR}/stocks-trader.js`;
export const CMD_FLAG_FUNDS_LIMIT_PERCENT = 'fundsLimitPercent';
export const CMD_FLAG_ENABLE_SHORT_SALES = 'enableShort';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_FUNDS_LIMIT_PERCENT, 0.25],
  [CMD_FLAG_ENABLE_SHORT_SALES, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'stocks-trader';
const SUBSCRIBER_NAME = 'stocks-trader';

const TAIL_X_POS = 840;
const TAIL_Y_POS = 140;
const TAIL_WIDTH = 635;
const TAIL_HEIGHT = 485;

const PURCHASE_FORECAST_MARGIN = 0.1;

let scriptConfig: StocksTraderConfig;
let fundsLimitPercent: number;

async function tradeStocks(
  eventData: StocksTickerEvent,
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const stockListings = eventData.stockListings ?? [];
  if (stockListings.length < 1) {
    return;
  }
  stockListings.sort(
    (listingA, listingB) => listingB.forecastScore - listingA.forecastScore
  );

  const nsLocator = nsPackage.ghost;
  const netscript = nsPackage.netscript;

  // Handle Sales Transactions
  let totalSaleProfits = 0;
  const soldStocks = [];
  for (const stockDetails of stockListings) {
    if (
      stockDetails.position.longShares > 0 &&
      stockDetails.forecast <= FIFTY_PERCENT
    ) {
      const saleTransaction: SaleTransaction = {
        symbol: stockDetails.symbol,
        position: TransactionPosition.LONG,
        profit: await sellPosition(
          stockDetails.symbol,
          stockDetails.position.longShares,
          stockDetails.position.longPrice,
          nsLocator.stock['sellStock']
        ),
      };
      logWriter.writeLine(
        `Sold ${netscript.formatNumber(
          stockDetails.position.longShares
        )} shares of ${stockDetails.symbol} for $${netscript.formatNumber(
          saleTransaction.profit
        )} profit`
      );
      totalSaleProfits += saleTransaction.profit;
      soldStocks.push(saleTransaction);
    } else if (
      stockDetails.position.shortShares > 0 &&
      stockDetails.forecast >= FIFTY_PERCENT
    ) {
      const saleTransaction: SaleTransaction = {
        symbol: stockDetails.symbol,
        position: TransactionPosition.SHORT,
        profit: await sellPosition(
          stockDetails.symbol,
          stockDetails.position.shortShares,
          stockDetails.position.shortPrice,
          nsLocator.stock['sellShort']
        ),
      };
      logWriter.writeLine(
        `Sold ${netscript.formatNumber(
          stockDetails.position.shortShares
        )} shares of ${stockDetails.symbol} for $${netscript.formatNumber(
          saleTransaction.profit
        )} profit`
      );
      totalSaleProfits += saleTransaction.profit || 0;
      soldStocks.push(saleTransaction);
    }
  }
  if (soldStocks.length > 0) {
    logWriter.writeLine(
      `Sold ${soldStocks.length} stocks for $${netscript.formatNumber(
        totalSaleProfits
      )} profit`
    );
    sendMessage(new StocksSoldEvent(soldStocks));
  }

  // Handle Purchase Transactions
  let playerMoney = netscript.getServerMoneyAvailable(HOME_SERVER_NAME);
  let totalPurchaseCosts = 0;
  const purchasedStocks = [];
  for (
    let stockCounter = 0;
    scriptConfig.purchaseStocks &&
    stockCounter < stockListings.length &&
    playerMoney > scriptConfig.fundsLimit + COMMISSION;
    stockCounter++
  ) {
    const availableFunds = playerMoney - scriptConfig.fundsLimit;
    const stockDetails = stockListings[stockCounter];
    if (
      stockDetails.forecast > FIFTY_PERCENT + PURCHASE_FORECAST_MARGIN &&
      stockDetails.askPrice + COMMISSION < availableFunds
    ) {
      const purchaseTransaction: PurchaseTransaction = {
        symbol: stockDetails.symbol,
        position: TransactionPosition.LONG,
        cost: await buyPosition(
          stockDetails.symbol,
          stockDetails.askPrice,
          stockDetails.maxShares,
          stockDetails.position,
          availableFunds,
          nsLocator.stock['buyStock']
        ),
      };

      if (purchaseTransaction.cost > 0) {
        logWriter.writeLine(
          `Purchased ${stockDetails.symbol} for $${netscript.formatNumber(
            purchaseTransaction.cost
          )}`
        );
        totalPurchaseCosts += purchaseTransaction.cost;
        purchasedStocks.push(purchaseTransaction);
      }
    } else if (
      scriptConfig.shortSales &&
      stockDetails.forecast < FIFTY_PERCENT - PURCHASE_FORECAST_MARGIN &&
      stockDetails.bidPrice + COMMISSION < availableFunds
    ) {
      const purchaseTransaction: PurchaseTransaction = {
        symbol: stockDetails.symbol,
        position: TransactionPosition.LONG,
        cost: await buyPosition(
          stockDetails.symbol,
          stockDetails.bidPrice,
          stockDetails.maxShares,
          stockDetails.position,
          availableFunds,
          nsLocator.stock['buyShort']
        ),
      };

      if (purchaseTransaction.cost > 0) {
        logWriter.writeLine(
          `Purchased ${stockDetails.symbol} for $${netscript.formatNumber(
            purchaseTransaction.cost
          )}`
        );
        totalPurchaseCosts += purchaseTransaction.cost;
        purchasedStocks.push(purchaseTransaction);
      }
    }

    playerMoney = netscript.getServerMoneyAvailable(HOME_SERVER_NAME);
  }
  if (purchasedStocks.length > 0) {
    logWriter.writeLine(
      `Purchased ${purchasedStocks.length} stocks for $${netscript.formatNumber(
        totalPurchaseCosts
      )} cost`
    );
    sendMessage(new StocksPurchasedEvent(purchasedStocks));
  }

  if (soldStocks.length + purchasedStocks.length > 0) {
    logWriter.writeLine(SECTION_DIVIDER);
  }
}

async function setupStockTrader(
  eventData: StockListingsResponse,
  nsPackage: NetscriptPackage,
  eventListener: EventListener,
  terminalWriter: TerminalLogger,
  scriptLogWriter: ScriptLogger,
  fundsLimitPercent: number
) {
  eventListener.removeListeners(StockListingsResponse, setupStockTrader);

  const nsLocator = nsPackage.ghost;
  const netscript = nsPackage.netscript;

  terminalWriter.writeLine(
    'Selling all stock positions for accurate funds limit calculation...'
  );
  let totalProfit = 0;
  for (const stockListing of eventData.stockListings ?? []) {
    if (stockListing.position.longShares > 0) {
      totalProfit += await sellPosition(
        stockListing.symbol,
        stockListing.position.longShares,
        stockListing.position.longPrice,
        nsLocator.stock['sellStock']
      );
    }
    if (stockListing.position.shortShares > 0) {
      totalProfit += await sellPosition(
        stockListing.symbol,
        stockListing.position.shortShares,
        stockListing.position.shortPrice,
        nsLocator.stock['sellShort']
      );
    }
  }
  terminalWriter.writeLine(
    `All stock positions sold for $${netscript.formatNumber(
      totalProfit
    )} profit`
  );

  scriptConfig.fundsLimit =
    netscript.getServerMoneyAvailable(HOME_SERVER_NAME) * fundsLimitPercent;

  const successMsg = `Stock trader setup successfully with funds limit $${netscript.formatNumber(
    scriptConfig.fundsLimit
  )}`;
  scriptLogWriter.writeLine(successMsg);
  scriptLogWriter.writeLine('Waiting for Stock Ticker Event...');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  eventListener.addListener(
    StocksTickerEvent,
    tradeStocks,
    nsPackage,
    scriptLogWriter
  );

  terminalWriter.writeLine(successMsg);
  terminalWriter.writeLine('See script logs for on-going trade details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);
}

function handleUpdateConfigEvent(
  eventData: StocksTraderConfigEvent,
  netscript: NS,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  const newConfig = eventData.config;
  scriptConfig.fundsLimit = newConfig.fundsLimit ?? scriptConfig.fundsLimit;
  if (scriptConfig.fundsLimit < 0) {
    scriptConfig.fundsLimit = netscript.getPlayer().money * fundsLimitPercent;
  }
  scriptConfig.purchaseStocks =
    newConfig.purchaseStocks ?? scriptConfig.purchaseStocks;
  scriptConfig.shortSales = newConfig.shortSales ?? scriptConfig.shortSales;

  logWriter.writeLine(`  Short Sales Enabled : ${scriptConfig.shortSales}`);
  logWriter.writeLine(`  Purchase Stocks : ${scriptConfig.purchaseStocks}`);
  logWriter.writeLine(
    `  Funds Limit : $${netscript.formatNumber(scriptConfig.fundsLimit)}`
  );
}

function handleConfigRequest(
  requestData: StocksTraderConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending stocks trader config response to ${requestData.sender}`
  );
  sendMessage(new StocksTraderConfigResponse(scriptConfig), requestData.sender);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getGhostPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Stock Market Trade Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  fundsLimitPercent = cmdArgs[CMD_FLAG_FUNDS_LIMIT_PERCENT].valueOf() as number;
  const shortEnabled = cmdArgs[
    CMD_FLAG_ENABLE_SHORT_SALES
  ].valueOf() as boolean;

  terminalWriter.writeLine(
    `Funds Safety Limit Percent : ${netscript.formatPercent(fundsLimitPercent)}`
  );
  terminalWriter.writeLine(`Short Sales Enabled : ${shortEnabled}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (!netscript.stock.hasWSEAccount() || !netscript.stock.hasTIXAPIAccess()) {
    terminalWriter.writeLine(
      'Script needs World Stock Exchange account and API access to trade stocks!'
    );
    return;
  }

  if (!runStockTicker(netscript)) {
    terminalWriter.writeLine(
      'Failed to find or execute a Stock Forecasting script!'
    );
    return;
  }

  scriptConfig = {
    shortSales: shortEnabled,
    purchaseStocks: true,
    fundsLimit: 0,
  };

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(
    StocksTraderConfigRequest,
    handleConfigRequest,
    scriptLogWriter
  );
  eventListener.addListener(
    StocksTraderConfigEvent,
    handleUpdateConfigEvent,
    netscript,
    scriptLogWriter
  );

  eventListener.addListener(
    StockListingsResponse,
    setupStockTrader,
    nsPackage,
    eventListener,
    terminalWriter,
    scriptLogWriter,
    fundsLimitPercent
  );
  const portfolioListingsRequestSent = await sendMessageRetry(
    netscript,
    new StockListingsRequest(SUBSCRIBER_NAME)
  );
  if (!portfolioListingsRequestSent) {
    terminalWriter.writeLine(
      'Failed to send request for current stock portfolio listings.  Try re-running this script.'
    );
    return;
  }

  await eventLoop(netscript, eventListener);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
