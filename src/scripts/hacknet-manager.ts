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

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
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

const CMD_FLAG_PURCHASE_NODES = 'purchaseNodes';
const CMD_FLAG_PURCHASE_UPGRADES = 'purchaseUpgrades';
const CMD_FLAG_FUNDS_LIMIT_PERCENT = 'fundsLimitPercent';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_PURCHASE_NODES, false],
  [CMD_FLAG_PURCHASE_UPGRADES, false],
  [CMD_FLAG_FUNDS_LIMIT_PERCENT, 0],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const TAIL_X_POS = 1650;
const TAIL_Y_POS = 52;
const TAIL_WIDTH = 670;
const TAIL_HEIGHT = 515;

const LOOP_DELAY_MILLISEC = 5000;

let fundsLimitPercent: number;
let managerConfig: HacknetManagerConfig;

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
  let availableFunds = netscript.getPlayer().money - managerConfig.fundsLimit;
  let orderPurchased = false;
  if (
    managerConfig.purchaseNodes &&
    hacknetApi.numNodes() < hacknetApi.maxNumNodes() &&
    (!managerConfig.purchaseUpgrades ||
      !upgradeOrders.length ||
      nodeCost < upgradeOrders[0].cost) &&
    nodeCost <= availableFunds
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

  terminalWriter.writeLine(`Dont Purchase Nodes : ${purchaseNodes}`);
  terminalWriter.writeLine(`Dont Purchase Upgrades : ${purchaseUpgrades}`);
  terminalWriter.writeLine(`Funds Limit Percent : ${fundsLimitPercent}`);
  terminalWriter.writeLine(`Funds Limit : ${fundsLimit}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  managerConfig = {
    purchaseNodes: purchaseNodes,
    purchaseUpgrades: purchaseUpgrades,
    fundsLimit: fundsLimit,
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

  await delayedInfiniteLoop(
    netscript,
    LOOP_DELAY_MILLISEC,
    manageOrdersAndPurchases,
    netscript,
    upgradeOrders,
    scriptLogWriter
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
