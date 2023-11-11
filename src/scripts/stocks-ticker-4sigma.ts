import {NS} from '@ns';

import {getLogger, Logger, LoggerMode} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {delayedInfiniteLoop} from '/scripts/workflows/execution';
import {
  FIFTY_PERCENT,
  getPosition,
  STOCKS_TICKER_HISTORY_SCRIPT,
  StockListing,
} from '/scripts/workflows/stocks';

import {EventListener, sendEvent} from '/scripts/comms/event-comms';
import {StocksTickerEvent} from '/scripts/comms/events/stocks-ticker-event';
import {StockListingsRequest} from '/scripts/comms/events/stocks-listing-request';
import {StockListingsResponse} from '/scripts/comms/events/stocks-listing-response';

const SUBSCRIBER_NAME = 'stocks-ticker-4sigma';
const REFRESH_LISTINGS_DELAY = 1500;
const STOCK_LISTINGS_MAP = new Map<string, StockListing>();

function updateStockListings(netscript: NS, logWriter: Logger) {
  logWriter.writeLine('Updating Stock Listings from 4Sigma Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  const allSymbols = netscript.stock.getSymbols();
  const updatedSymbols = new Array<StockListing>();
  for (const symbol of allSymbols) {
    const askPrice = netscript.stock.getAskPrice(symbol);
    const bidPrice = netscript.stock.getBidPrice(symbol);
    const stockMaxShares = netscript.stock.getMaxShares(symbol);
    const stockVolatility = netscript.stock.getVolatility(symbol);
    const stockForecast = netscript.stock.getForecast(symbol);
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
      const stockMaxShares = netscript.stock.getMaxShares(symbol);
      const stockPosition = getPosition(netscript, symbol);
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
      updatedSymbols.push(stockListing);
      logWriter.writeLine(`  Forecast score : ${stockListing.forecastScore}`);
      logWriter.writeLine(ENTRY_DIVIDER);
    }
  }

  if (updatedSymbols.length > 0) {
    sendEvent(new StocksTickerEvent(updatedSymbols));
    logWriter.writeLine(`Updated ${updatedSymbols.length} stock listings.`);
  } else {
    logWriter.writeLine('No stock listings updated.');
  }
  logWriter.writeLine(SECTION_DIVIDER);
}

function sendListings(eventData: StockListingsRequest) {
  const result = new Array<StockListing>();
  for (const symbol of eventData.symbols ?? STOCK_LISTINGS_MAP.keys()) {
    const stockListing = STOCK_LISTINGS_MAP.get(symbol);
    if (stockListing) {
      result.push(stockListing);
    }
  }
  sendEvent(new StockListingsResponse(result), eventData.subscriber);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'stocks-ticker-4sigma',
    LoggerMode.SCRIPT
  );
  logWriter.writeLine('Stock Market Ticker - 4Sigma Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  if (netscript.isRunning(STOCKS_TICKER_HISTORY_SCRIPT)) {
    throw new Error(
      `Conflicting stock ticker script running : ${STOCKS_TICKER_HISTORY_SCRIPT}`
    );
  }

  const eventListener = new EventListener(netscript, SUBSCRIBER_NAME);
  eventListener.addListeners(StockListingsRequest, sendListings);

  await delayedInfiniteLoop(
    netscript,
    REFRESH_LISTINGS_DELAY,
    updateStockListings,
    netscript,
    logWriter
  );
}
