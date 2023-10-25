import {AutocompleteData, NS} from '@ns';

import {removeEmptyString} from '/scripts/common/shared';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';
import {
  CmdArgsSchema,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

const CMD_FLAG_MAX_TRANSACTIONS = 'maxTransactions';
const CMD_FLAG_STOCK_PRICES_CSV = 'stockPricesCsv';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_MAX_TRANSACTIONS, 0],
  [CMD_FLAG_STOCK_PRICES_CSV, ''],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

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
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const maxTransactions = cmdArgs.maxTransactions.valueOf() as number;
  const stockPricesCsv = cmdArgs.stockPricesCsv.valueOf() as string;
  const stockPrices = stockPricesCsv
    .split(',')
    .filter(removeEmptyString)
    .map(Number);

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

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  return CMD_FLAGS;
}
