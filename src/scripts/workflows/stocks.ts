import {NS} from '@ns';

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
  playerMoney: number,
  buyStockFunc: BuySellStockFunction
) {
  const shares = Math.min(
    Math.floor((playerMoney - COMMISSION) / price),
    maxShares
  );
  const purchasePrice = buyStockFunc(symbol, shares);
  return purchasePrice * shares;
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
  getPosition,
  buyStock,
  sellStock,
};
