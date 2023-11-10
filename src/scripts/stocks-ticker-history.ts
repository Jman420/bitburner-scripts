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

const HISTORICAL_RECORD_DEPTH = 20;
const REFRESH_LISTINGS_DELAY = 1500;
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
    const currentListing = STOCK_LISTING_MAP.get(symbol);

    if (
      !currentListing ||
      currentListing.askPrice !== askPrice ||
      currentListing.bidPrice !== bidPrice
    ) {
      logWriter.writeLine(`Updating historical records for ${symbol}`);
      const historicalDetails =
        HISTORICAL_DETAILS_MAP.get(symbol) ?? new HistoricalStockDetails();
      const currentPrice = netscript.stock.getPrice(symbol);
      historicalDetails.prices.unshift(currentPrice);
      historicalDetails.priceChanges.unshift();
      HISTORICAL_DETAILS_MAP.set(symbol, historicalDetails);

      logWriter.writeLine(`Updating stock listing for symbol : ${symbol}`);
      const stockMaxShares = netscript.stock.getMaxShares(symbol);
      const stockVolatility = 0; // TODO (JMG) : Predict stock volatility from historical records
      const stockForecast = 0; // TODO (JMG) : Predict stock forecast from historical records
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
