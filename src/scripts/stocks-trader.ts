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

import {HOME_SERVER_NAME} from '/scripts/common/shared';

import {eventLoop, initializeScript} from '/scripts/workflows/execution';
import {
  COMMISSION,
  FIFTY_PERCENT,
  PurchaseTransaction,
  SaleTransaction,
  StocksTraderConfig,
  TransactionPosition,
  buyStock,
  runStockTicker,
  sellStock,
} from '/scripts/workflows/stocks';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
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

const CMD_FLAG_FUNDS_SAFETY_LIMIT = 'fundsSafetyLimit';
const CMD_FLAG_ENABLE_SHORT_SALES = 'enableShort';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_FUNDS_SAFETY_LIMIT, 0.25],
  [CMD_FLAG_ENABLE_SHORT_SALES, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'stocks-trader';
const SUBSCRIBER_NAME = 'stocks-trader';

const TAIL_X_POS = 1230;
const TAIL_Y_POS = 120;
const TAIL_WIDTH = 1090;
const TAIL_HEIGHT = 490;

const PURCHASE_FORECAST_MARGIN = 0.1;

let traderConfig: StocksTraderConfig;

function tradeStocks(
  eventData: StocksTickerEvent,
  netscript: NS,
  logWriter: Logger
) {
  const stockListings = eventData.stockListings ?? [];
  if (stockListings.length < 1) {
    return;
  }
  stockListings.sort(
    (listingA, listingB) => listingB.forecastScore - listingA.forecastScore
  );

  // Handle Sales Transactions
  let totalSaleProfits = 0;
  const soldStocks = new Array<SaleTransaction>();
  for (const stockDetails of stockListings) {
    if (
      stockDetails.position.longShares > 0 &&
      stockDetails.forecast <= FIFTY_PERCENT
    ) {
      const saleTransaction: SaleTransaction = {
        symbol: stockDetails.symbol,
        position: TransactionPosition.LONG,
        profit: sellStock(
          stockDetails.symbol,
          stockDetails.position.longShares,
          stockDetails.position.longPrice,
          netscript.stock.sellStock
        ),
      };
      totalSaleProfits += saleTransaction.profit;
      soldStocks.push(saleTransaction);
    } else if (
      stockDetails.position.shortShares > 0 &&
      stockDetails.forecast >= FIFTY_PERCENT
    ) {
      const saleTransaction: SaleTransaction = {
        symbol: stockDetails.symbol,
        position: TransactionPosition.SHORT,
        profit: sellStock(
          stockDetails.symbol,
          stockDetails.position.shortShares,
          stockDetails.position.shortPrice,
          netscript.stock.sellShort
        ),
      };
      totalSaleProfits += saleTransaction.profit;
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
  const purchasedStocks = new Array<PurchaseTransaction>();
  for (
    let stockCounter = 0;
    traderConfig.purchaseStocks &&
    stockCounter < stockListings.length &&
    playerMoney > traderConfig.fundsLimit + COMMISSION;
    stockCounter++
  ) {
    const availableFunds = playerMoney - traderConfig.fundsLimit;
    const stockDetails = stockListings[stockCounter];
    if (
      stockDetails.forecast > FIFTY_PERCENT + PURCHASE_FORECAST_MARGIN &&
      stockDetails.askPrice + COMMISSION < availableFunds
    ) {
      const purchaseTransaction: PurchaseTransaction = {
        symbol: stockDetails.symbol,
        position: TransactionPosition.LONG,
        cost: buyStock(
          stockDetails.symbol,
          stockDetails.askPrice,
          stockDetails.maxShares,
          stockDetails.position,
          availableFunds,
          netscript.stock.buyStock
        ),
      };

      if (purchaseTransaction.cost > 0) {
        totalPurchaseCosts += purchaseTransaction.cost;
        purchasedStocks.push(purchaseTransaction);
      }
    } else if (
      traderConfig.shortSales &&
      stockDetails.forecast < FIFTY_PERCENT - PURCHASE_FORECAST_MARGIN &&
      stockDetails.bidPrice + COMMISSION < availableFunds
    ) {
      const purchaseTransaction: PurchaseTransaction = {
        symbol: stockDetails.symbol,
        position: TransactionPosition.LONG,
        cost: buyStock(
          stockDetails.symbol,
          stockDetails.bidPrice,
          stockDetails.maxShares,
          stockDetails.position,
          availableFunds,
          netscript.stock.buyShort
        ),
      };

      if (purchaseTransaction.cost > 0) {
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

function setupStockTrader(
  eventData: StockListingsResponse,
  netscript: NS,
  eventListener: EventListener,
  terminalWriter: TerminalLogger,
  scriptLogWriter: ScriptLogger,
  fundsLimitPercent: number
) {
  eventListener.removeListeners(StockListingsResponse, setupStockTrader);

  terminalWriter.writeLine(
    'Selling all stock positions for accurate funds limit calculation...'
  );
  let totalProfit = 0;
  for (const stockListing of eventData.stockListings ?? []) {
    if (stockListing.position.longShares > 0) {
      totalProfit += sellStock(
        stockListing.symbol,
        stockListing.position.longShares,
        stockListing.position.longPrice,
        netscript.stock.sellStock
      );
    }
    if (stockListing.position.shortShares > 0) {
      totalProfit += sellStock(
        stockListing.symbol,
        stockListing.position.shortShares,
        stockListing.position.shortPrice,
        netscript.stock.sellShort
      );
    }
  }
  terminalWriter.writeLine(
    `All stock positions sold for $${netscript.formatNumber(
      totalProfit
    )} profit`
  );

  const fundsLimit =
    netscript.getServerMoneyAvailable(HOME_SERVER_NAME) * fundsLimitPercent;
  if (fundsLimit <= COMMISSION) {
    terminalWriter.writeLine(
      'Funds limit must be greater than transaction commission amount'
    );
    terminalWriter.writeLine(
      `  Commission : $${netscript.formatNumber(COMMISSION)}`
    );
    terminalWriter.writeLine(
      `  Funds Limit : $${netscript.formatNumber(fundsLimit)}`
    );
    netscript.exit();
  }
  traderConfig.fundsLimit = fundsLimit;

  const successMsg = `Stock trader setup successfully with funds limit $${netscript.formatNumber(
    fundsLimit
  )}`;
  scriptLogWriter.writeLine(successMsg);
  scriptLogWriter.writeLine('Waiting for Stock Ticker Event...');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  eventListener.addListener(
    StocksTickerEvent,
    tradeStocks,
    netscript,
    scriptLogWriter
  );

  terminalWriter.writeLine(successMsg);
  terminalWriter.writeLine('See script logs for on-going trade details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);
}

function handleStocksTraderConfigEvent(
  eventData: StocksTraderConfigEvent,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  traderConfig = eventData.config;

  logWriter.writeLine(`  Short Sales Enabled : ${traderConfig.shortSales}`);
  logWriter.writeLine(`  Purchase Stocks : ${traderConfig.purchaseStocks}`);
  logWriter.writeLine(`  Funds Limit : ${traderConfig.fundsLimit}`);
}

function handleStocksTraderConfigRequest(
  requestData: StocksTraderConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending stocks trader config response to ${requestData.sender}`
  );
  sendMessage(new StocksTraderConfigResponse(traderConfig), requestData.sender);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Stock Market Trade Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const fundsLimitPercent = cmdArgs[
    CMD_FLAG_FUNDS_SAFETY_LIMIT
  ].valueOf() as number;
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

  traderConfig = {
    shortSales: shortEnabled,
    purchaseStocks: true,
    fundsLimit: 0,
  };

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  eventListener.addListener(
    StocksTraderConfigRequest,
    handleStocksTraderConfigRequest,
    scriptLogWriter
  );
  eventListener.addListener(
    StocksTraderConfigEvent,
    handleStocksTraderConfigEvent,
    scriptLogWriter
  );

  eventListener.addListener(
    StockListingsResponse,
    setupStockTrader,
    netscript,
    eventListener,
    terminalWriter,
    scriptLogWriter,
    fundsLimitPercent
  );
  sendMessage(new StockListingsRequest(SUBSCRIBER_NAME));

  await eventLoop(netscript, eventListener);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_SAFETY_LIMIT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
