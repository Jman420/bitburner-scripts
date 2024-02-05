import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  POWER_2_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {infiniteLoop, initializeScript} from '/scripts/workflows/execution';

import {
  CMD_FLAG_NAME_PREFIX,
  DEFAULT_NODE_NAME_PREFIX,
  ServerFarmOrder,
  getNodeCount,
  getNodeUpgradeOrder,
  nearestPowerOf2,
} from '/scripts/workflows/server-farm';
import {
  NetscriptPackage,
  getGhostPackage,
} from '/scripts/netscript-services/netscript-ghost';

const CMD_FLAG_MIN_RAM = 'minimumRam';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_MIN_RAM, 2],
  [CMD_FLAG_NAME_PREFIX, DEFAULT_NODE_NAME_PREFIX],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'server-manager';
const SUBSCRIBER_NAME = 'server-manager';

const UPDATE_DELAY = 5000;

function sortUpgradeOrders(upgradeOrders: Array<ServerFarmOrder>) {
  upgradeOrders.sort((order1, order2) => order1.cost - order2.cost);
}

async function initializeUpgradeOrders(nsPackage: NetscriptPackage) {
  const nsLocator = nsPackage.ghost;
  const netscript = nsPackage.netscript;

  const upgradeOrders = [];
  const farmNodes = await nsLocator['getPurchasedServers']();
  for (const hostname of farmNodes) {
    upgradeOrders.push(getNodeUpgradeOrder(netscript, hostname));
  }
  sortUpgradeOrders(upgradeOrders);
  return upgradeOrders;
}

async function manageOrdersAndPurchases(
  nsPackage: NetscriptPackage,
  logWriter: Logger,
  upgradeOrders: Array<ServerFarmOrder>,
  namePrefix: string,
  minRamOrder = 2
) {
  const nsLocator = nsPackage.ghost;
  const netscript = nsPackage.netscript;

  logWriter.writeLine('Checking Server Farm Purchase Node Order...');
  const nodeCost = netscript.getPurchasedServerCost(minRamOrder);
  if (
    (await getNodeCount(nsLocator)) < netscript.getPurchasedServerLimit() &&
    (!upgradeOrders.length || nodeCost < upgradeOrders[0].cost) &&
    nodeCost <= netscript.getPlayer().money
  ) {
    logWriter.writeLine(
      `Purchasing new Server Farm Node for $${netscript.formatNumber(
        nodeCost
      )}...`
    );
    const hostname = await nsLocator['purchaseServer'](namePrefix, minRamOrder);
    logWriter.writeLine(
      `Successfully purchased new Server Farm Node with index : ${hostname}`
    );

    logWriter.writeLine(
      `Adding new Server Farm Node ${hostname} Upgrade Orders...`
    );
    const nodeUpgradeOrder = getNodeUpgradeOrder(netscript, hostname);
    upgradeOrders.unshift(nodeUpgradeOrder);
    logWriter.writeLine(
      `Successfully added Server Farm Node ${hostname} Upgrade Orders.`
    );
  }

  logWriter.writeLine(
    `Checking ${upgradeOrders.length} Server Farm Upgrade Orders...`
  );
  while (
    upgradeOrders.length > 0 &&
    upgradeOrders[0].cost <= netscript.getPlayer().money
  ) {
    const orderDetails = upgradeOrders.shift();
    if (!orderDetails) {
      break;
    }

    logWriter.writeLine(
      `Purchasing ${netscript.formatRam(
        orderDetails.ramAmount
      )} RAM upgrade for node ${
        orderDetails.hostname
      } for $${netscript.formatNumber(orderDetails.cost)}...`
    );
    orderDetails.purchaseFunc(orderDetails.hostname, orderDetails.ramAmount);
    logWriter.writeLine(
      `Successfully purchased ${netscript.formatRam(
        orderDetails.ramAmount
      )} RAM upgrade for node ${orderDetails.hostname}`
    );

    logWriter.writeLine(
      `Updating upgrade cost for server farm node ${orderDetails.hostname}...`
    );
    upgradeOrders.push(getNodeUpgradeOrder(netscript, orderDetails.hostname));
    sortUpgradeOrders(upgradeOrders);
    logWriter.writeLine(
      `Successfully updated upgrade cost for server farm node ${orderDetails.hostname}`
    );
  }
  logWriter.writeLine(ENTRY_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getGhostPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  logWriter.writeLine('Server Farm Purchase Manager');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const minRamRequested = cmdArgs[CMD_FLAG_MIN_RAM].valueOf() as number;
  const minRamOrder = nearestPowerOf2(minRamRequested);
  const namePrefix = cmdArgs[CMD_FLAG_NAME_PREFIX].valueOf() as string;

  logWriter.writeLine(`Minimum Ram Requested : ${minRamRequested}`);
  logWriter.writeLine(`Minimum Ram Order : ${minRamOrder}`);
  logWriter.writeLine(`Name Prefix : ${namePrefix}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Initializing Server Farm Upgrade Orders...');
  const upgradeOrders = await initializeUpgradeOrders(nsPackage);
  logWriter.writeLine(
    `Found ${upgradeOrders.length} available Server Farm Upgrades.`
  );
  logWriter.writeLine('See script logs for on-going purchase details.');
  netscript.tail();

  await infiniteLoop(
    netscript,
    manageOrdersAndPurchases,
    UPDATE_DELAY,
    nsPackage,
    scriptLogWriter,
    upgradeOrders,
    namePrefix,
    minRamOrder
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MIN_RAM)) {
    return POWER_2_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_NAME_PREFIX)) {
    return [DEFAULT_NODE_NAME_PREFIX];
  }
  return CMD_FLAGS;
}
