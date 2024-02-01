import {NS} from '@ns';
import {runScript} from '/scripts/workflows/execution';
import {scanWideNetwork} from '/scripts/workflows/recon';
import {
  NetscriptLocator,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';
import {SCRIPTS_DIR} from '/scripts/common/shared';

type BuySellStockFunction = (
  symbol: string,
  shares: number
) => number | Promise<number>;

enum TransactionPosition {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

interface StocksTraderConfig {
  shortSales: boolean;
  purchaseStocks: boolean;
  fundsLimit: number;
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

interface StockTransaction {
  symbol: string;
  position: TransactionPosition;
}

interface SaleTransaction extends StockTransaction {
  profit: number;
}

interface PurchaseTransaction extends StockTransaction {
  cost: number;
}

const STOCKS_TICKER_HISTORY_SCRIPT = `${SCRIPTS_DIR}/stocks-ticker-history.js`;
const STOCKS_TICKER_4SIGMA_SCRIPT = `${SCRIPTS_DIR}/stocks-ticker-4sigma.js`;

const FIFTY_PERCENT = 0.5;
const COMMISSION = 100000;
const TOTAL_STOCKS = 33;

function runStockTicker(netscript: NS) {
  let stockForecastPid = -1;
  if (
    !netscript.isRunning(STOCKS_TICKER_HISTORY_SCRIPT) &&
    !netscript.isRunning(STOCKS_TICKER_4SIGMA_SCRIPT)
  ) {
    if (netscript.stock.has4SDataTIXAPI()) {
      stockForecastPid = runScript(netscript, STOCKS_TICKER_4SIGMA_SCRIPT);
    } else {
      stockForecastPid = runScript(netscript, STOCKS_TICKER_HISTORY_SCRIPT);
    }
  }
  return stockForecastPid !== 0;
}

async function getStockPosition(nsLocator: NetscriptLocator, symbol: string) {
  const [longShares, longPrice, shortShares, shortPrice] =
    await nsLocator.stock['getPosition'](symbol);
  const result: StockPosition = {
    longShares: longShares,
    longPrice: longPrice,
    shortShares: shortShares,
    shortPrice: shortPrice,
  };
  return result;
}

async function getPortfolioValue(nsPackage: NetscriptPackage) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const stockApi = nsLocator.stock;

  const result = {totalValue: 0, totalProfit: 0};
  if (!netscript.stock.hasTIXAPIAccess()) {
    return result;
  }

  const allSymbols = await stockApi['getSymbols']();
  for (const stockSymbol of allSymbols) {
    const stockPosition = await getStockPosition(nsLocator, stockSymbol);
    const askPrice = await stockApi['getAskPrice'](stockSymbol);
    const bidPrice = await stockApi['getBidPrice'](stockSymbol);

    const longValue = stockPosition.longShares * bidPrice;
    const shortValue = stockPosition.shortShares * askPrice;

    result.totalValue += longValue - COMMISSION;
    result.totalValue += shortValue - COMMISSION;

    result.totalProfit +=
      longValue - stockPosition.longShares * stockPosition.longPrice;
    result.totalProfit +=
      shortValue - stockPosition.shortShares * stockPosition.shortPrice;
  }

  return result;
}

async function buyPosition(
  symbol: string,
  price: number,
  maxShares: number,
  playerPosition: StockPosition,
  playerMoney: number,
  buyStockFunc: BuySellStockFunction
) {
  const totalPositionShares =
    playerPosition.longShares + playerPosition.shortShares;
  if (playerPosition.longShares + playerPosition.shortShares >= maxShares) {
    return 0;
  }

  const shares = Math.min(
    Math.floor((playerMoney - COMMISSION) / price),
    maxShares - totalPositionShares
  );
  const purchasePrice = await buyStockFunc(symbol, shares);
  return purchasePrice > 0 ? purchasePrice * shares + COMMISSION : 0;
}

async function sellPosition(
  symbol: string,
  shares: number,
  purchasePrice: number,
  sellStockFunc: BuySellStockFunction
) {
  const salePrice = await sellStockFunc(symbol, shares);
  const saleTotal = salePrice * shares;
  const saleCost = purchasePrice * shares + COMMISSION * 2;
  return saleTotal - saleCost;
}

async function sellPortfolio(nsLocator: NetscriptLocator) {
  const stockApi = nsLocator.stock;

  if (!(await stockApi['hasTIXAPIAccess']())) {
    return;
  }

  const allSymbols = await stockApi['getSymbols']();
  for (const stockSymbol of allSymbols) {
    const stockPosition = await getStockPosition(nsLocator, stockSymbol);
    if (stockPosition.longShares > 0) {
      await stockApi['sellStock'](stockSymbol, stockPosition.longShares);
    }
    if (stockPosition.shortShares > 0) {
      await stockApi['sellShort'](stockSymbol, stockPosition.shortShares);
    }
  }
}

async function getHostnamesFromSymbol(
  nsPackage: NetscriptPackage,
  symbol: string
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const results = [];
  const symbolChars = symbol.split('');
  const allHosts = scanWideNetwork(netscript, false);
  for (const hostname of allHosts) {
    const hostDetails = await nsLocator['getServer'](hostname);
    let hostOrgName = hostDetails.organizationName.toUpperCase();

    if (!hostOrgName.includes('POLICE') && !hostOrgName.includes('NIGHT')) {
      const symbolMatched = symbolChars.every(char => {
        const charIndex = hostOrgName.indexOf(char);
        if (charIndex > -1) {
          hostOrgName = hostOrgName.slice(charIndex + 1);
          return true;
        }
        return false;
      });

      if (symbolMatched) {
        results.push(hostname);
      }
    }
  }

  return results;
}

export {
  TransactionPosition,
  StocksTraderConfig,
  StockPosition,
  StockListing,
  StockTransaction,
  SaleTransaction,
  PurchaseTransaction,
  STOCKS_TICKER_HISTORY_SCRIPT,
  STOCKS_TICKER_4SIGMA_SCRIPT,
  FIFTY_PERCENT,
  COMMISSION,
  TOTAL_STOCKS,
  runStockTicker,
  getStockPosition,
  getPortfolioValue,
  buyPosition,
  sellPosition,
  sellPortfolio,
  getHostnamesFromSymbol,
};
