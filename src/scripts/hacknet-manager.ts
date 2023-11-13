import {Hacknet, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {HacknetOrder, getNodeUpgradeOrders} from '/scripts/workflows/hacknet';

const MODULE_NAME = 'hacknet-manager';
const SUBSCRIBER_NAME = 'hacknet-manager';

const LOOP_DELAY_MILLISEC = 5000;

function sortUpgradeOrders(upgradeOrders: Array<HacknetOrder>) {
  upgradeOrders.sort((entry1, entry2) => entry1.cost - entry2.cost);
}

function initializeUpgradeOrders(hacknetApi: Hacknet) {
  const upgradeOrders = new Array<HacknetOrder>();
  for (
    let nodeCounter = 0;
    nodeCounter < hacknetApi.numNodes();
    nodeCounter++
  ) {
    const nodeUpgradeOrders = getNodeUpgradeOrders(hacknetApi, nodeCounter);
    upgradeOrders.push(...nodeUpgradeOrders);
  }
  sortUpgradeOrders(upgradeOrders);

  return upgradeOrders;
}

function manageOrdersAndPurchases(
  netscript: NS,
  upgradeOrders: Array<HacknetOrder>,
  logWriter: Logger
) {
  const hacknetApi = netscript.hacknet;
  const nodeCost = hacknetApi.getPurchaseNodeCost();
  let orderPurchased = false;
  if (
    hacknetApi.numNodes() < hacknetApi.maxNumNodes() &&
    (!upgradeOrders.length || nodeCost < upgradeOrders[0].cost) &&
    nodeCost <= netscript.getPlayer().money
  ) {
    logWriter.writeLine(
      `Purchasing new Hacknet Node for $${netscript.formatNumber(nodeCost)}...`
    );
    const newNodeIndex = hacknetApi.purchaseNode();

    logWriter.writeLine(
      `Adding new Hacknet Node ${newNodeIndex} Upgrade Orders...`
    );
    const nodeUpgradeOrders = getNodeUpgradeOrders(hacknetApi, newNodeIndex);
    sortUpgradeOrders(nodeUpgradeOrders);
    upgradeOrders.unshift(...nodeUpgradeOrders);
    orderPurchased = true;
  }

  while (
    upgradeOrders.length > 0 &&
    upgradeOrders[0].cost <= netscript.getPlayer().money
  ) {
    const orderDetails = upgradeOrders.shift();
    if (!orderDetails) {
      break;
    }

    logWriter.writeLine(
      `Purchasing ${orderDetails.resource} upgrade for node ${
        orderDetails.nodeIndex
      } for $${netscript.formatNumber(orderDetails.cost)}...`
    );
    orderDetails.purchaseFunc(orderDetails.nodeIndex);

    logWriter.writeLine(
      `Updating upgrade cost for ${orderDetails.resource} on node ${orderDetails.nodeIndex}...`
    );
    upgradeOrders.push(
      ...getNodeUpgradeOrders(
        hacknetApi,
        orderDetails.nodeIndex,
        orderDetails.resource
      )
    );
    sortUpgradeOrders(upgradeOrders);
    orderPurchased = true;
  }

  if (orderPurchased) {
    logWriter.writeLine(ENTRY_DIVIDER);
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  logWriter.writeLine('Hacknet Purchase Manager');
  logWriter.writeLine(SECTION_DIVIDER);
  netscript.tail();

  logWriter.writeLine('Initializing Hacknet Upgrade Orders...');
  const upgradeOrders = initializeUpgradeOrders(netscript.hacknet);
  logWriter.writeLine(
    `Found ${upgradeOrders.length} available Hacknet Upgrades.`
  );
  logWriter.writeLine(SECTION_DIVIDER);

  await delayedInfiniteLoop(
    netscript,
    LOOP_DELAY_MILLISEC,
    manageOrdersAndPurchases,
    netscript,
    upgradeOrders,
    logWriter
  );
}
