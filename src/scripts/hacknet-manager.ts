import {AutocompleteData, Hacknet, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';
import {
  HacknetManagerConfig,
  HacknetOrder,
  getNodeUpgradeOrders,
} from '/scripts/workflows/hacknet';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {HacknetConfigRequest} from '/scripts/comms/requests/hacknet-config-request';
import {HacknetConfigResponse} from '/scripts/comms/responses/hacknet-config-response';
import {HacknetManagerConfigEvent} from '/scripts/comms/events/hacknet-manager-config-event';

import {openTail} from '/scripts/workflows/ui';

const MODULE_NAME = 'hacknet-manager';
const SUBSCRIBER_NAME = 'hacknet-manager';

export const HACKNET_MANAGER_SCRIPT = 'scripts/hacknet-manager.js';
const DEFAULT_MAX_NODES = 15;
export const CMD_FLAG_PURCHASE_NODES = 'purchaseNodes';
export const CMD_FLAG_PURCHASE_UPGRADES = 'purchaseUpgrades';
export const CMD_FLAG_FUNDS_LIMIT_PERCENT = 'fundsLimitPercent';
export const CMD_FLAG_MAX_NODES = 'maxNodes';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_PURCHASE_NODES, false],
  [CMD_FLAG_PURCHASE_UPGRADES, false],
  [CMD_FLAG_FUNDS_LIMIT_PERCENT, 0],
  [CMD_FLAG_MAX_NODES, DEFAULT_MAX_NODES],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const TAIL_X_POS = 1660;
const TAIL_Y_POS = 15;
const TAIL_WIDTH = 670;
const TAIL_HEIGHT = 515;

const UPDATE_DELAY = 5000;

let fundsLimitPercent: number;
let managerConfig: HacknetManagerConfig;

function sortUpgradeOrders(upgradeOrders: Array<HacknetOrder>) {
  upgradeOrders.sort((entry1, entry2) => entry1.cost - entry2.cost);
}

function initializeUpgradeOrders(hacknetApi: Hacknet) {
  const upgradeOrders = [];
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

  while (
    hacknetApi.numNodes() < managerConfig.maxNodes ||
    upgradeOrders.length > 0
  ) {
    const nodeCost = hacknetApi.getPurchaseNodeCost();
    let availableFunds = netscript.getPlayer().money - managerConfig.fundsLimit;
    let orderPurchased = false;
    if (
      managerConfig.purchaseNodes &&
      hacknetApi.numNodes() < managerConfig.maxNodes &&
      nodeCost <= availableFunds
    ) {
      logWriter.writeLine(
        `Purchasing new hacknet node for $${netscript.formatNumber(
          nodeCost
        )}...`
      );
      const newNodeIndex = hacknetApi.purchaseNode();

      logWriter.writeLine(
        `Adding new hacknet node ${newNodeIndex} upgrade orders...`
      );
      const nodeUpgradeOrders = getNodeUpgradeOrders(hacknetApi, newNodeIndex);
      sortUpgradeOrders(nodeUpgradeOrders);
      upgradeOrders.unshift(...nodeUpgradeOrders);
      orderPurchased = true;
    }

    availableFunds = netscript.getPlayer().money - managerConfig.fundsLimit;
    while (
      managerConfig.purchaseUpgrades &&
      upgradeOrders.length > 0 &&
      upgradeOrders[0].cost <= availableFunds
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
      availableFunds = netscript.getPlayer().money - managerConfig.fundsLimit;

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

    await netscript.asleep(UPDATE_DELAY);
  }
}

function handleUpdateConfigEvent(
  eventData: HacknetManagerConfigEvent,
  netscript: NS,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  managerConfig = eventData.config;
  if (managerConfig.fundsLimit < 0) {
    managerConfig.fundsLimit = netscript.getPlayer().money * fundsLimitPercent;
  }
  if (managerConfig.maxNodes < 0) {
    managerConfig.maxNodes = DEFAULT_MAX_NODES;
  }

  logWriter.writeLine(`  Purchase Nodes : ${managerConfig.purchaseNodes}`);
  logWriter.writeLine(
    `  Purchase Upgrades : ${managerConfig.purchaseUpgrades}`
  );
  logWriter.writeLine(
    `  Funds Limit : $${netscript.formatNumber(managerConfig.fundsLimit)}`
  );
}

function handleHacknetConfigRequest(
  requestData: HacknetConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending hacknet manager config response to ${requestData.sender}`
  );
  sendMessage(new HacknetConfigResponse(managerConfig), requestData.sender);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Hacknet Purchase Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const purchaseNodes = cmdArgs[CMD_FLAG_PURCHASE_NODES].valueOf() as boolean;
  const purchaseUpgrades = cmdArgs[
    CMD_FLAG_PURCHASE_UPGRADES
  ].valueOf() as boolean;
  fundsLimitPercent = cmdArgs[CMD_FLAG_FUNDS_LIMIT_PERCENT].valueOf() as number;
  const fundsLimit = fundsLimitPercent * netscript.getPlayer().money;
  const maxNodes = Math.min(
    cmdArgs[CMD_FLAG_MAX_NODES].valueOf() as number,
    netscript.hacknet.maxNumNodes()
  );

  terminalWriter.writeLine(`Dont Purchase Nodes : ${purchaseNodes}`);
  terminalWriter.writeLine(`Dont Purchase Upgrades : ${purchaseUpgrades}`);
  terminalWriter.writeLine(`Funds Limit Percent : ${fundsLimitPercent}`);
  terminalWriter.writeLine(`Funds Limit : ${fundsLimit}`);
  terminalWriter.writeLine(`Max Nodes : ${maxNodes}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  managerConfig = {
    purchaseNodes: purchaseNodes,
    purchaseUpgrades: purchaseUpgrades,
    fundsLimit: fundsLimit,
    maxNodes: maxNodes,
  };

  terminalWriter.writeLine('See script logs for on-going purchase details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(
    HacknetManagerConfigEvent,
    handleUpdateConfigEvent,
    netscript,
    scriptLogWriter
  );
  eventListener.addListener(
    HacknetConfigRequest,
    handleHacknetConfigRequest,
    scriptLogWriter
  );

  scriptLogWriter.writeLine('Initializing Hacknet Upgrade Orders...');
  const upgradeOrders = initializeUpgradeOrders(netscript.hacknet);
  scriptLogWriter.writeLine(
    `Found ${upgradeOrders.length} available Hacknet Upgrades.`
  );
  scriptLogWriter.writeLine(SECTION_DIVIDER);

  await manageOrdersAndPurchases(netscript, upgradeOrders, scriptLogWriter);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MAX_NODES)) {
    return [5, 10, 15, 20];
  }
  return CMD_FLAGS;
}
