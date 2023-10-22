import {Hacknet, NS} from '@ns';

import {Logger, getLogger} from '/scripts/logging/loggerManager';
import {HacknetOrder, getNodeUpgradeOrders} from '/scripts/workflows/hacknet';
import {delayedInfiniteLoop} from '/scripts/workflows/shared';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

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

async function manageOrdersAndPurchases(
  netscript: NS,
  upgradeOrders: Array<HacknetOrder>,
  logWriter: Logger
) {
  const hacknetApi = netscript.hacknet;

  logWriter.writeLine('Checking Hacknet Purchase Node Order...');
  const nodeCost = hacknetApi.getPurchaseNodeCost();
  if (
    hacknetApi.numNodes() < hacknetApi.maxNumNodes() &&
    (!upgradeOrders.length || nodeCost < upgradeOrders[0].cost) &&
    nodeCost <= netscript.getPlayer().money
  ) {
    logWriter.writeLine(`Purchasing new Hacknet Node for $${nodeCost}...`);
    const newNodeIndex = hacknetApi.purchaseNode();
    logWriter.writeLine(
      `Successfully purchased new Hacknet Node with index : ${newNodeIndex}.`
    );

    logWriter.writeLine(
      `Adding new Hacknet Node ${newNodeIndex} Upgrade Orders...`
    );
    const nodeUpgradeOrders = getNodeUpgradeOrders(hacknetApi, newNodeIndex);
    sortUpgradeOrders(nodeUpgradeOrders);
    upgradeOrders.unshift(...nodeUpgradeOrders);
    logWriter.writeLine(
      `Successfully added Hacknet Node ${newNodeIndex} Upgrade Orders.`
    );
  }

  logWriter.writeLine(
    `Checking ${upgradeOrders.length} Hacknet Upgrade Orders...`
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
      `Purchasing ${orderDetails.resource} upgrade for node ${orderDetails.nodeIndex} for $${orderDetails.cost}...`
    );
    orderDetails.purchaseFunc(orderDetails.nodeIndex);
    logWriter.writeLine(
      `Successfully purchased ${orderDetails.resource} upgrade for node ${orderDetails.nodeIndex}.`
    );

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
    logWriter.writeLine(
      `Successfully updated upgrade cost for ${orderDetails.resource} on node ${orderDetails.nodeIndex}.`
    );
  }
  logWriter.writeLine(ENTRY_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'hacknet-manager');
  logWriter.writeLine('Hacknet Purchase Manager');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Initializing Hacknet Upgrade Orders...');
  const upgradeOrders = initializeUpgradeOrders(netscript.hacknet);
  logWriter.writeLine(
    `Found ${upgradeOrders.length} available Hacknet Upgrades.`
  );
  logWriter.writeLine(ENTRY_DIVIDER);

  await delayedInfiniteLoop(
    netscript,
    LOOP_DELAY_MILLISEC,
    manageOrdersAndPurchases,
    netscript,
    upgradeOrders,
    logWriter
  );
}
