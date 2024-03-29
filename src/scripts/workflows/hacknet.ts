import {Hacknet} from '@ns';

type CostFunction = (nodeIndex: number, amount?: number) => number;
type PurchaseFunction = (nodeIndex: number, amount?: number) => boolean;

enum HacknetResources {
  LEVEL = 'Level',
  RAM = 'RAM',
  CORE = 'Core',
  ALL = 'All',
}

interface HacknetManagerConfig {
  purchaseNodes: boolean;
  purchaseUpgrades: boolean;
  fundsLimit: number;
  maxNodes: number;
}

interface HacknetOrder {
  nodeIndex: number;
  resource: HacknetResources;
  cost: number;
  purchaseFunc: PurchaseFunction;
}

interface HacknetPurchaseDetails {
  resource: HacknetResources;
  costFunc: CostFunction;
  purchaseFunc: PurchaseFunction;
}

function getNodeUpgradeOrders(
  hacknetApi: Hacknet,
  nodeIndex: number,
  resourceType: HacknetResources = HacknetResources.ALL
) {
  const HACKNET_RESOURCE_DETAILS = new Map<
    HacknetResources,
    HacknetPurchaseDetails
  >([
    [
      HacknetResources.LEVEL,
      {
        resource: HacknetResources.LEVEL,
        costFunc: hacknetApi.getLevelUpgradeCost,
        purchaseFunc: hacknetApi.upgradeLevel,
      },
    ],
    [
      HacknetResources.RAM,
      {
        resource: HacknetResources.RAM,
        costFunc: hacknetApi.getRamUpgradeCost,
        purchaseFunc: hacknetApi.upgradeRam,
      },
    ],
    [
      HacknetResources.CORE,
      {
        resource: HacknetResources.CORE,
        costFunc: hacknetApi.getCoreUpgradeCost,
        purchaseFunc: hacknetApi.upgradeCore,
      },
    ],
  ]);

  const resourceDetails = HACKNET_RESOURCE_DETAILS.get(resourceType);
  let includedResourceDetails = HACKNET_RESOURCE_DETAILS;
  if (resourceDetails) {
    includedResourceDetails = new Map<HacknetResources, HacknetPurchaseDetails>(
      [[resourceDetails.resource, resourceDetails]]
    );
  }

  const upgradeOrders = [];
  for (const resourceDetails of includedResourceDetails.values()) {
    const upgradeCost = resourceDetails.costFunc(nodeIndex);
    if (upgradeCost > 0 && upgradeCost < Infinity) {
      upgradeOrders.push({
        nodeIndex: nodeIndex,
        resource: resourceDetails.resource,
        cost: upgradeCost,
        purchaseFunc: resourceDetails.purchaseFunc,
      });
    }
  }
  return upgradeOrders;
}

export {
  PurchaseFunction,
  HacknetManagerConfig,
  HacknetResources,
  HacknetOrder,
  getNodeUpgradeOrders,
};
