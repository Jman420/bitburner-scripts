import {NS} from '@ns';
import {runScript} from '/scripts/workflows/execution';

type BuySellStockFunction = (symbol: string, shares: number) => number;

enum TransactionPosition {
  LONG,
  SHORT,
}

interface StockPosition {
  longShares: number;
  longPrice: number;
  shortShares: number;
  shortPrice: number;
}

interface StockListing {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  maxShares: number;
  volatility: number;
  forecast: number;
  forecastScore: number;
  position: StockPosition;
}

interface SaleTransaction {
  symbol: string;
  position: TransactionPosition;
  profit: number;
}

interface PurchaseTransaction {
  symbol: string;
  position: TransactionPosition;
  cost: number;
}

const STOCKS_TICKER_HISTORY_SCRIPT = '/scripts/stocks-ticker-history.js';
const STOCKS_TICKER_4SIGMA_SCRIPT = '/scripts/stocks-ticker-4sigma.js';

const FIFTY_PERCENT = 0.5;
const COMMISSION = 100000;
const TOTAL_STOCKS = 33;

function runTicker(netscript: NS) {
  let stockForecastPid = -1;
  if (
    !netscript.isRunning(STOCKS_TICKER_HISTORY_SCRIPT) &&
    !netscript.isRunning(STOCKS_TICKER_4SIGMA_SCRIPT)
  ) {
    if (netscript.stock.has4SDataTIXAPI()) {
      stockForecastPid = runScript(
        netscript,
        STOCKS_TICKER_4SIGMA_SCRIPT,
        netscript.getHostname()
      );
    } else {
      stockForecastPid = runScript(
        netscript,
        STOCKS_TICKER_HISTORY_SCRIPT,
        netscript.getHostname()
      );
    }
  }
  return stockForecastPid !== 0;
}

function getPosition(netscript: NS, symbol: string) {
  const [longShares, longPrice, shortShares, shortPrice] =
    netscript.stock.getPosition(symbol);
  const result: StockPosition = {
    longShares: longShares,
    longPrice: longPrice,
    shortShares: shortShares,
    shortPrice: shortPrice,
  };
  return result;
}

function buyStock(
  symbol: string,
  price: number,
  maxShares: number,
  playerPosition: StockPosition,
  playerMoney: number,
  buyStockFunc: BuySellStockFunction
) {
  if (playerPosition.longShares + playerPosition.shortShares >= maxShares) {
    return 0;
  }

  const shares = Math.min(
    Math.floor((playerMoney - COMMISSION) / price),
    maxShares
  );
  const purchasePrice = buyStockFunc(symbol, shares);
  return purchasePrice > 0 ? purchasePrice * shares + COMMISSION : 0;
}

function sellStock(
  symbol: string,
  shares: number,
  purchasePrice: number,
  sellStockFunc: BuySellStockFunction
) {
  const salePrice = sellStockFunc(symbol, shares);
  const saleTotal = salePrice * shares;
  const saleCost = purchasePrice * shares + COMMISSION * 2;
  return saleTotal - saleCost;
}

export {
  TransactionPosition,
  StockPosition,
  StockListing,
  SaleTransaction,
  PurchaseTransaction,
  STOCKS_TICKER_HISTORY_SCRIPT,
  STOCKS_TICKER_4SIGMA_SCRIPT,
  FIFTY_PERCENT,
  COMMISSION,
  TOTAL_STOCKS,
  runTicker,
  getPosition,
  buyStock,
  sellStock,
};
