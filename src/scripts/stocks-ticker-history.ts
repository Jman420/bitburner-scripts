import {NS} from '@ns';

import {getLogger, Logger, LoggerMode} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {
  FIFTY_PERCENT,
  getPosition,
  STOCKS_TICKER_4SIGMA_SCRIPT,
  StockListing,
} from '/scripts/workflows/stocks';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {StocksTickerEvent} from '/scripts/comms/events/stocks-ticker-event';
import {StockListingsRequest} from '/scripts/comms/requests/stocks-listing-request';
import {StockListingsResponse} from '/scripts/comms/responses/stocks-listing-response';

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

const MODULE_NAME = 'stocks-ticker-history';
const SUBSCRIBER_NAME = 'stocks-ticker-history';

const UPDATE_DELAY = 0;
const HISTORICAL_RECORD_DEPTH = 20;
const MIN_RECORDS_FOR_FORECAST = 10;
const HISTORICAL_DETAILS_MAP = new Map<string, HistoricalStockDetails>();
const STOCK_LISTINGS_MAP = new Map<string, StockListing>();

async function updateStockListings(netscript: NS, logWriter: Logger) {
  logWriter.writeLine('Updating Stock Listings from Historical Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  const allSymbols = netscript.stock.getSymbols();
  const updatedListings = new Array<StockListing>();
  for (const symbol of allSymbols) {
    const askPrice = netscript.stock.getAskPrice(symbol);
    const bidPrice = netscript.stock.getBidPrice(symbol);
    const stockMaxShares = netscript.stock.getMaxShares(symbol);
    const currentListing = STOCK_LISTINGS_MAP.get(symbol);

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
  const result = new Array<StockListing>();
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
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  logWriter.writeLine('Stock Market Ticker - Historical Market Data');
  logWriter.writeLine(SECTION_DIVIDER);

  if (netscript.isRunning(STOCKS_TICKER_4SIGMA_SCRIPT)) {
    throw new Error(
      `Conflicting stock ticker script running : ${STOCKS_TICKER_4SIGMA_SCRIPT}`
    );
  }

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(StockListingsRequest, sendListings);

  HISTORICAL_DETAILS_MAP.clear();
  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    updateStockListings,
    netscript,
    logWriter
  );
}
