import {NS} from '@ns';
import {runScript} from '/scripts/workflows/execution';
import {scanWideNetwork} from '/scripts/workflows/recon';

type BuySellStockFunction = (symbol: string, shares: number) => number;

enum TransactionPosition {
  LONG = 'LONG',
  SHORT = 'SHORT',
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

const STOCKS_TICKER_HISTORY_SCRIPT = '/scripts/stocks-ticker-history.js';
const STOCKS_TICKER_4SIGMA_SCRIPT = '/scripts/stocks-ticker-4sigma.js';
const STOCKS_TRADER_SCRIPT = '/scripts/stocks-trader.js';

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
  const totalPositionShares =
    playerPosition.longShares + playerPosition.shortShares;
  if (playerPosition.longShares + playerPosition.shortShares >= maxShares) {
    return 0;
  }

  const shares = Math.min(
    Math.floor((playerMoney - COMMISSION) / price),
    maxShares - totalPositionShares
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

function getHostnamesFromSymbol(netscript: NS, symbol: string) {
  const results = new Array<string>();
  const symbolChars = symbol.split('');
  const allHosts = scanWideNetwork(netscript, false);
  for (const hostname of allHosts) {
    const hostDetails = netscript.getServer(hostname);
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
  StockPosition,
  StockListing,
  StockTransaction,
  SaleTransaction,
  PurchaseTransaction,
  STOCKS_TICKER_HISTORY_SCRIPT,
  STOCKS_TICKER_4SIGMA_SCRIPT,
  STOCKS_TRADER_SCRIPT,
  FIFTY_PERCENT,
  COMMISSION,
  TOTAL_STOCKS,
  runStockTicker,
  getPosition,
  buyStock,
  sellStock,
  getHostnamesFromSymbol,
};
