import {NS} from '@ns';

import {CmdArgsSchema} from '/scripts/common/shared';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

const CMD_ARG_MAX_TRANSACTIONS = 'maxTransactions';
const CMD_ARG_STOCK_PRICES_CSV = 'stockPricesCsv';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [
  [CMD_ARG_MAX_TRANSACTIONS, 0],
  [CMD_ARG_STOCK_PRICES_CSV, ''],
];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'max-stock-profit',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Calculate Maximum Stock Profit');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = netscript.flags(CMD_ARGS_SCHEMA);
  const maxTransactions = cmdArgs.maxTransactions.valueOf() as number;
  const stockPricesCsv = cmdArgs.stockPricesCsv.valueOf() as string;
  const stockPrices = stockPricesCsv.split(',').map(Number);

  logWriter.writeLine(`Max Transactions : ${maxTransactions}`);
  logWriter.writeLine(`Stock Prices : ${stockPrices}`);
  logWriter.writeLine(SECTION_DIVIDER);

  let totalProfit = 0;
  let transactionCounter = 0;
  for (
    let priceCounter = 0;
    priceCounter < stockPrices.length - 1 &&
    transactionCounter < maxTransactions;
    priceCounter++
  ) {
    const todayPrice = stockPrices[priceCounter];
    const tomorrowPrice = stockPrices[priceCounter + 1];

    if (todayPrice < tomorrowPrice) {
      const transactionProfit = tomorrowPrice - todayPrice;
      totalProfit += transactionProfit;
      transactionCounter++;
      logWriter.writeLine(
        `Transaction (${tomorrowPrice} - ${todayPrice}) : Profit ${transactionProfit}`
      );
    }
  }
  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine(`Max Profit : ${totalProfit}`);
}
