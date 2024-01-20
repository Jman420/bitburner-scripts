import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  ENTRY_DIVIDER,
  SECTION_DIVIDER,
  convertMillisecToTime,
} from '/scripts/logging/logOutput';

import {
  CMD_FLAG_INCLUDE_HOME,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {
  infiniteLoop,
  initializeScript,
  runScript,
} from '/scripts/workflows/execution';

import {
  StockTransaction,
  TransactionPosition,
  getHostnamesFromSymbol,
} from '/scripts/workflows/stocks';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {StocksPurchasedEvent} from '/scripts/comms/events/stocks-purchased-event';
import {StocksSoldEvent} from '/scripts/comms/events/stocks-sold-event';
import {StockListingsResponse} from '/scripts/comms/responses/stocks-listing-response';
import {StockListingsRequest} from '/scripts/comms/requests/stocks-listing-request';

import {analyzeHost} from '/scripts/workflows/recon';
import {growHost, hackHost} from '/scripts/workflows/orchestration';
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';
import {STOCKS_TRADER_SCRIPT} from '/scripts/stocks-trader';

const CMD_FLAG_ATTACK_HOSTS = 'attackHosts';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_ATTACK_HOSTS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'stocks-manipulator';
const SUBSCRIBER_NAME = 'stocks-manipulator';

function setupStocksManipulator(
  eventData: StockListingsResponse,
  eventListener: EventListener,
  logWriter: Logger,
  targetTransactions: Map<string, StockTransaction>
) {
  logWriter.writeLine('Setting up Stocks Manipulator...');
  eventListener.removeListeners(StockListingsResponse, setupStocksManipulator);

  logWriter.writeLine('  Getting current stock portfolio details...');
  for (const stockListing of eventData.stockListings ?? []) {
    if (stockListing.position.longShares > 0) {
      targetTransactions.set(stockListing.symbol, {
        symbol: stockListing.symbol,
        position: TransactionPosition.LONG,
      });
    } else if (stockListing.position.shortShares > 0) {
      targetTransactions.set(stockListing.symbol, {
        symbol: stockListing.symbol,
        position: TransactionPosition.SHORT,
      });
    }
  }

  logWriter.writeLine('  Adding stock transaction event listeners...');
  eventListener.addListener(
    StocksPurchasedEvent,
    handleStocksPurchasedEvent,
    logWriter,
    targetTransactions
  );
  eventListener.addListener(
    StocksSoldEvent,
    handleStocksSoldEvent,
    logWriter,
    targetTransactions
  );
  logWriter.writeLine(SECTION_DIVIDER);
}

function handleStocksPurchasedEvent(
  eventData: StocksPurchasedEvent,
  logWriter: Logger,
  targetTransactions: Map<string, StockTransaction>
) {
  const addedTransactions = [];
  for (const transactionDetails of eventData.transactions ?? []) {
    if (!targetTransactions.has(transactionDetails.symbol)) {
      addedTransactions.push(transactionDetails);
      targetTransactions.set(transactionDetails.symbol, transactionDetails);
    }
  }

  if (addedTransactions.length > 0) {
    logWriter.writeLine('Added purchased stocks to target transactions...');
    for (const transactionDetails of addedTransactions) {
      logWriter.writeLine(
        `  Added symbol ${transactionDetails.symbol} with position : ${transactionDetails.position}`
      );
    }
    logWriter.writeLine(SECTION_DIVIDER);
  }
}

function handleStocksSoldEvent(
  eventData: StocksSoldEvent,
  logWriter: Logger,
  targetTransactions: Map<string, StockTransaction>
) {
  const removedTransactions = [];
  for (const transactionDetails of eventData.transactions ?? []) {
    removedTransactions.push(transactionDetails);
    targetTransactions.delete(transactionDetails.symbol);
  }

  if (removedTransactions.length > 0) {
    logWriter.writeLine('Removing sold stocks from target transactions...');
    for (const transactionDetails of removedTransactions) {
      logWriter.writeLine(
        `  Removing symbol ${transactionDetails.symbol} with position : ${transactionDetails.position}`
      );
    }
    logWriter.writeLine(SECTION_DIVIDER);
  }
}

async function runAttacks(
  nsPackage: NetscriptPackage,
  logWriter: Logger,
  attackHosts: string[],
  includeHome: boolean,
  targetTransactions: Map<string, StockTransaction>
) {
  if (targetTransactions.size < 1) {
    return;
  }

  const netscript = nsPackage.netscript;

  logWriter.writeLine(
    `Manipulating stocks prices for ${targetTransactions.size} symbols...`
  );
  for (const transaction of targetTransactions.values()) {
    logWriter.writeLine(ENTRY_DIVIDER);
    const symbolHosts = await getHostnamesFromSymbol(
      nsPackage,
      transaction.symbol
    );
    for (const hostname of symbolHosts) {
      logWriter.writeLine(
        `  Attacking ${hostname} (${transaction.symbol}) for transaction type : ${transaction.position}`
      );
      const hostDetails = analyzeHost(netscript, hostname);
      if (transaction.position === TransactionPosition.LONG) {
        logWriter.writeLine(
          `    Growing ${hostname} to maximum funds (~${convertMillisecToTime(
            hostDetails.growTime
          )}))...`
        );
        await growHost(netscript, hostDetails, true, includeHome, 1, true);
      } else if (transaction.position === TransactionPosition.SHORT) {
        logWriter.writeLine(
          `    Hacking ${hostname} for 95% of funds (~${convertMillisecToTime(
            hostDetails.hackTime
          )})...`
        );
        await hackHost(netscript, hostDetails, false, includeHome, 0.95, true);
      }
    }
  }
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Stock Market Manipulator');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;
  const attackHosts = cmdArgs[CMD_FLAG_ATTACK_HOSTS].valueOf() as string[];

  terminalWriter.writeLine(`Include Home Attacker : ${includeHome}`);
  terminalWriter.writeLine(`Attack Hosts : ${attackHosts}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (!runScript(netscript, STOCKS_TRADER_SCRIPT)) {
    terminalWriter.writeLine(
      'Failed to find or execute a the stocks trader script!'
    );
    return;
  }

  terminalWriter.writeLine('See script logs for on-going attack details.');
  netscript.tail();

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const eventListener = new EventListener(SUBSCRIBER_NAME);

  const targetTransactions = new Map<string, StockTransaction>();
  eventListener.addListener(
    StockListingsResponse,
    setupStocksManipulator,
    eventListener,
    scriptLogWriter,
    targetTransactions
  );
  sendMessage(new StockListingsRequest(SUBSCRIBER_NAME));

  await infiniteLoop(
    netscript,
    runAttacks,
    nsPackage,
    scriptLogWriter,
    attackHosts,
    includeHome,
    targetTransactions
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_ATTACK_HOSTS)) {
    return data.servers;
  }
  return CMD_FLAGS;
}
