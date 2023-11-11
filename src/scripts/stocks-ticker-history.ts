import {NS} from '@ns';

import {getLogger, Logger, LoggerMode} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {delayedInfiniteLoop} from '/scripts/workflows/execution';
import {
  FIFTY_PERCENT,
  getPosition,
  STOCKS_TICKER_4SIGMA_SCRIPT,
  StockListing,
} from '/scripts/workflows/stocks';

import {sendEvent} from '/scripts/comms/event-comms';
import {StocksTickerEvent} from '/scripts/comms/events/stocks-ticker-event';

class FixedLengthQueue<TElement> extends Array<TElement> {
  readonly fixedLength: number;

  constructor(fixedLength: number) {
    super();

    this.fixedLength = fixedLength;
  }

  unshift(...items: TElement[]): number {
    const result = super.unshift(...items);

    while (this.length > this.fixedLength) {
      this.pop();
    }

    return result > this.fixedLength ? this.fixedLength : result;
  }
}

class HistoricalStockDetails {
  readonly prices = new FixedLengthQueue<number>(HISTORICAL_RECORD_DEPTH);
  readonly priceChanges = new FixedLengthQueue<number>(HISTORICAL_RECORD_DEPTH);
}

const REFRESH_LISTINGS_DELAY = 1500;
const HISTORICAL_RECORD_DEPTH = 20;
const MIN_RECORDS_FOR_FORECAST = 4;
const HISTORICAL_DETAILS_MAP = new Map<string, HistoricalStockDetails>();
const STOCK_LISTING_MAP = new Map<string, StockListing>();

function updateStockListings(netscript: NS, logWriter: Logger) {
  logWriter.writeLine('Updating Stock Listings from Historical Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  const allSymbols = netscript.stock.getSymbols();
  const updatedListings = new Array<StockListing>();
  for (const symbol of allSymbols) {
    const askPrice = netscript.stock.getAskPrice(symbol);
    const bidPrice = netscript.stock.getBidPrice(symbol);
    const stockMaxShares = netscript.stock.getMaxShares(symbol);
    const currentListing = STOCK_LISTING_MAP.get(symbol);

    if (
      !currentListing ||
      currentListing.askPrice !== askPrice ||
      currentListing.bidPrice !== bidPrice ||
      currentListing.maxShares !== stockMaxShares
    ) {
      logWriter.writeLine(`Updating historical records for ${symbol}`);
      const historicalDetails =
        HISTORICAL_DETAILS_MAP.get(symbol) ?? new HistoricalStockDetails();
      const currentPrice = netscript.stock.getPrice(symbol);
      const previousPrice = historicalDetails.prices.at(0) ?? currentPrice;
      historicalDetails.prices.unshift(currentPrice);
      historicalDetails.priceChanges.unshift(currentPrice / previousPrice);
      HISTORICAL_DETAILS_MAP.set(symbol, historicalDetails);

      logWriter.writeLine(`Calculating stock forecast for ${symbol}`);
      let changeSum = 0;
      let increaseChangeCount = 0;
      for (const changeAmount of historicalDetails.priceChanges) {
        changeSum += changeAmount;
        increaseChangeCount += changeAmount > 1 ? 1 : 0;
      }
      const priceChangesLength = historicalDetails.priceChanges.length;
      const stockVolatility = changeSum / priceChangesLength;
      const stockForecast =
        priceChangesLength >= MIN_RECORDS_FOR_FORECAST
          ? increaseChangeCount / priceChangesLength
          : FIFTY_PERCENT;

      logWriter.writeLine(`Updating stock listing for symbol : ${symbol}`);
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

      STOCK_LISTING_MAP.set(symbol, stockListing);
      updatedListings.push(stockListing);
      logWriter.writeLine(`  Forecast score : ${stockListing.forecastScore}`);
      logWriter.writeLine(ENTRY_DIVIDER);
    }
  }

  sendEvent(new StocksTickerEvent(updatedListings));
  logWriter.writeLine(`Updated ${updatedListings.length} stock listings.`);
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'stocks-ticker-history',
    LoggerMode.SCRIPT
  );
  logWriter.writeLine('Stock Market Ticker - Historical Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  if (netscript.isRunning(STOCKS_TICKER_4SIGMA_SCRIPT)) {
    throw new Error(
      `Conflicting stock ticker script running : ${STOCKS_TICKER_4SIGMA_SCRIPT}`
    );
  }

  HISTORICAL_DETAILS_MAP.clear();
  await delayedInfiniteLoop(
    netscript,
    REFRESH_LISTINGS_DELAY,
    updateStockListings,
    netscript,
    logWriter
  );
}
