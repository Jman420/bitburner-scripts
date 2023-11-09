type BuySellStockFunction = (symbol: string, shares: number) => number;

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

const STOCK_FORECAST_HISTORY_SCRIPT = '/scripts/stocks-forecast-history.js';
const STOCK_FORECAST_4SIGMA_SCRIPT = '/scripts/stocks-forecast-4sigma.js';

const FIFTY_PERCENT = 0.5;
const COMMISSION = 100000;
const STOCK_LISTING_MAP = new Map<string, StockListing>();

function getAllStockListings() {
  return Array.from(STOCK_LISTING_MAP.values());
}

function getStockListing(symbol: string) {
  return STOCK_LISTING_MAP.get(symbol);
}

function updateStockListing(stockListing: StockListing) {
  STOCK_LISTING_MAP.set(stockListing.symbol, stockListing);
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

function buyStock(
  symbol: string,
  price: number,
  maxShares: number,
  playerMoney: number,
  buyStockFunc: BuySellStockFunction
) {
  const shares = Math.min(
    Math.floor(playerMoney - COMMISSION / price),
    maxShares
  );
  const purchasePrice = buyStockFunc(symbol, shares);
  return purchasePrice * shares;
}

export {
  StockPosition,
  StockListing,
  STOCK_FORECAST_HISTORY_SCRIPT,
  STOCK_FORECAST_4SIGMA_SCRIPT,
  FIFTY_PERCENT,
  COMMISSION,
  STOCK_LISTING_MAP,
  getAllStockListings,
  getStockListing,
  updateStockListing,
  sellStock,
  buyStock,
};
