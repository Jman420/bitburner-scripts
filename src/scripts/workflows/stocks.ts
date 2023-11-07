import { NS } from "@ns";

interface StockListing {
  symbol: string;
  longPrice: number;
  longShares: number;
  shortPrice: number;
  shortShares: number;
  bidPrice: number;
  askPrice: number;
  profit?: number;
  cost?: number;
}

interface StockListing4S {
  symbol: string;
  longPrice: number;
  longShares: number;
  shortPrice: number;
  shortShares: number;
  forecast: number;
  volatility: number;
  bidPrice: number;
  askPrice: number;
  maxShares: number;
  profit?: number;
  cost?: number;
  potentialProfit?: number;
}

const COMMISSION = 100000;

function getStockListings4S(netscript: NS) {
  const stockSymbols = netscript.stock.getSymbols();
  const stockListings = new Array<StockListing4S>();

  for (const symbol of stockSymbols) {
    
  }

  return stockListings;
}

export { StockListing4S, COMMISSION };
