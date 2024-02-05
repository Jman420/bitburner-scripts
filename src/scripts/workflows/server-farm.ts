import {NS} from '@ns';
import {NetscriptLocator} from '/scripts/netscript-services/netscript-locator';

type PurchaseFunction = (
  hostname: string,
  ram: number
) => boolean | string | Promise<boolean | string>;

const CMD_FLAG_NAME_PREFIX = 'namePrefix';
const DEFAULT_NODE_NAME_PREFIX = 'server-node';

interface ServerFarmOrder {
  hostname: string;
  ramAmount: number;
  cost: number;
  purchaseFunc: PurchaseFunction;
}

// Taken from : https://www.geeksforgeeks.org/smallest-power-of-2-greater-than-or-equal-to-n/#
// Function to find the smallest power of 2
// greater than or equal to value
function nearestPowerOf2(value: number) {
  // Calculate log2 of value
  const power = Math.floor(Math.log2(value));

  // If 2^power is equal to value, return value
  if (Math.pow(2, power) === value) {
    return value;
  }

  // Return 2^(power + 1)
  return Math.pow(2, power + 1);
}

async function getNodeCount(nsLocator: NetscriptLocator) {
  return (await nsLocator['getPurchasedServers']()).length;
}

function getNodeUpgradeOrder(netscript: NS, hostname: string): ServerFarmOrder {
  const currentServerRam = netscript.getServerMaxRam(hostname);
  const upgradedServerRam = nearestPowerOf2(currentServerRam + 1);
  const upgradeCost = netscript.getPurchasedServerUpgradeCost(
    hostname,
    upgradedServerRam
  );

  return {
    hostname: hostname,
    ramAmount: upgradedServerRam,
    cost: upgradeCost,
    purchaseFunc: netscript.upgradePurchasedServer,
  };
}

export {
  ServerFarmOrder,
  CMD_FLAG_NAME_PREFIX,
  DEFAULT_NODE_NAME_PREFIX,
  nearestPowerOf2,
  getNodeCount,
  getNodeUpgradeOrder,
};
