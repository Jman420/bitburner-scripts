import {NS} from '@ns';

import {getLogger, Logger, LoggerMode} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';

import {
  FIFTY_PERCENT,
  getStockPosition,
  STOCKS_TICKER_HISTORY_SCRIPT,
  StockListing,
} from '/scripts/workflows/stocks';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {StocksTickerEvent} from '/scripts/comms/events/stocks-ticker-event';
import {StockListingsRequest} from '/scripts/comms/requests/stocks-listing-request';
import {StockListingsResponse} from '/scripts/comms/responses/stocks-listing-response';
import {
  getLocatorPackage,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';

const MODULE_NAME = 'stocks-ticker-4sigma';
const SUBSCRIBER_NAME = 'stocks-ticker-4sigma';

const UPDATE_DELAY = 0;
const STOCK_LISTINGS_MAP = new Map<string, StockListing>();

async function updateStockListings(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  logWriter.writeLine('Updating Stock Listings from 4Sigma Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  const stockApi = nsLocator.stock;
  const allSymbols = await stockApi['getSymbols']();
  const updatedListings = [];
  for (const symbol of allSymbols) {
    const askPrice = await stockApi['getAskPrice'](symbol);
    const bidPrice = await stockApi['getBidPrice'](symbol);
    const stockMaxShares = await stockApi['getMaxShares'](symbol);
    const stockVolatility = await stockApi['getVolatility'](symbol);
    const stockForecast = await stockApi['getForecast'](symbol);
    const currentListing = STOCK_LISTINGS_MAP.get(symbol);

    if (
      !currentListing ||
      currentListing.askPrice !== askPrice ||
      currentListing.bidPrice !== bidPrice ||
      currentListing.maxShares !== stockMaxShares ||
      currentListing.volatility !== stockVolatility ||
      currentListing.forecast !== stockForecast
    ) {
      logWriter.writeLine(`Updating stock listing for symbol : ${symbol}`);
      const stockMaxShares = await stockApi['getMaxShares'](symbol);
      const stockPosition = await getStockPosition(nsLocator, symbol);
      const stockListing: StockListing = {
        symbol: symbol,
        askPrice: askPrice,
        bidPrice: bidPrice,
        maxShares: stockMaxShares,
        volatility: stockVolatility,
        forecast: stockForecast,
        forecastScore:
          Math.abs(stockForecast - FIFTY_PERCENT) * stockVolatility,
        position: stockPosition,
      };

      STOCK_LISTINGS_MAP.set(symbol, stockListing);
      updatedListings.push(stockListing);
      logWriter.writeLine(`  Forecast score : ${stockListing.forecastScore}`);
      logWriter.writeLine(ENTRY_DIVIDER);
    }
  }

  if (updatedListings.length > 0) {
    sendMessage(new StocksTickerEvent(updatedListings));
    logWriter.writeLine(`Updated ${updatedListings.length} stock listings.`);
  } else {
    logWriter.writeLine('No stock listings updated.');
  }
  logWriter.writeLine(SECTION_DIVIDER);

  await netscript.stock.nextUpdate();
}

function sendListings(eventData: StockListingsRequest) {
  const result = [];
  for (const symbol of eventData.symbols ?? STOCK_LISTINGS_MAP.keys()) {
    const stockListing = STOCK_LISTINGS_MAP.get(symbol);
    if (stockListing) {
      result.push(stockListing);
    }
  }
  sendMessage(new StockListingsResponse(result), eventData.sender);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  logWriter.writeLine('Stock Market Ticker - 4Sigma Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  if (netscript.isRunning(STOCKS_TICKER_HISTORY_SCRIPT)) {
    throw new Error(
      `Conflicting stock ticker script running : ${STOCKS_TICKER_HISTORY_SCRIPT}`
    );
  }

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(StockListingsRequest, sendListings);

  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    updateStockListings,
    nsPackage,
    logWriter
  );
}
