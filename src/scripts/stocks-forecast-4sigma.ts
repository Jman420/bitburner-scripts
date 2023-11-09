import {NS} from '@ns';

import {getLogger, Logger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {delayedInfiniteLoop} from '/scripts/workflows/execution';
import {
  FIFTY_PERCENT,
  getStockListing,
  STOCK_FORECAST_HISTORY_SCRIPT,
  StockListing,
  StockPosition,
  updateStockListing,
} from '/scripts/workflows/stocks';

import {sendEvent} from '/scripts/comms/event-comms';
import {StocksUpdatedEvent} from '/scripts/comms/messages/stocks-updated-event';

const REFRESH_LISTINGS_DELAY = 1500;

function updateStockListings(netscript: NS, logWriter: Logger) {
  logWriter.writeLine('Updating Stock Listings from 4Sigma Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  const allSymbols = netscript.stock.getSymbols();
  const updatedListings = new Array<string>();
  for (const symbol of allSymbols) {
    const askPrice = netscript.stock.getAskPrice(symbol);
    const bidPrice = netscript.stock.getBidPrice(symbol);
    const currentListing = getStockListing(symbol);

    if (
      !currentListing ||
      currentListing.askPrice !== askPrice ||
      currentListing.bidPrice !== bidPrice
    ) {
      logWriter.writeLine(`Updating stock listing for symbol : ${symbol}`);
      const stockMaxShares = netscript.stock.getMaxShares(symbol);
      const stockVolatility = netscript.stock.getVolatility(symbol);
      const stockForecast = netscript.stock.getForecast(symbol);
      const [longShares, longPrice, shortShares, shortPrice] =
        netscript.stock.getPosition(symbol);
      const stockPosition: StockPosition = {
        longShares: longShares,
        longPrice: longPrice,
        shortShares: shortShares,
        shortPrice: shortPrice,
      };
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

      updateStockListing(stockListing);
      updatedListings.push(symbol);
      logWriter.writeLine(`  Forecast score : ${stockListing.forecastScore}`);
      logWriter.writeLine(ENTRY_DIVIDER);
    }
  }

  sendEvent(new StocksUpdatedEvent(updatedListings));
  logWriter.writeLine(`Updated ${updatedListings.length} stock listings.`);
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'stocks-forecast-4sigma');
  logWriter.writeLine('Stock Market Forecast - 4Sigma');
  logWriter.writeLine(SECTION_DIVIDER);

  if (netscript.isRunning(STOCK_FORECAST_HISTORY_SCRIPT)) {
    throw new Error(
      `Conflicting stock forecast script running : ${STOCK_FORECAST_HISTORY_SCRIPT}`
    );
  }

  delayedInfiniteLoop(
    netscript,
    REFRESH_LISTINGS_DELAY,
    updateStockListings,
    netscript,
    logWriter
  );
}
