import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';

import {findServersForRam, getAvailableRam} from '/scripts/workflows/recon';
import {
  CMD_FLAG_NAME_PREFIX,
  DEFAULT_NODE_NAME_PREFIX,
  ServerFarmOrder,
  nearestPowerOf2,
} from '/scripts/workflows/server-farm';
import {openTail} from '/scripts/workflows/ui';

const CMD_FLAG_AMOUNT = 'amount';
const CMD_FLAG_RAM_EXPONENT = 'ramExponent';
const CMD_FLAG_EXCLUDE_FARM = 'excludeFarm';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_AMOUNT, 0],
  [CMD_FLAG_RAM_EXPONENT, 0],
  [CMD_FLAG_NAME_PREFIX, DEFAULT_NODE_NAME_PREFIX],
  [CMD_FLAG_EXCLUDE_FARM, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'server-demand';
const SUBSCRIBER_NAME = 'server-demand';

const TAIL_X_POS = 1501;
const TAIL_Y_POS = 86;
const TAIL_WIDTH = 820;
const TAIL_HEIGHT = 380;

const LOOP_DELAY_MILLISEC = 5000;

function getOrders(
  netscript: NS,
  logWriter: Logger,
  serverCount: number,
  ramAmount: number,
  serverNamePrefix: string,
  farmHosts: string[]
) {
  logWriter.writeLine(
    `Determining cheapest purchase path for ${serverCount} servers with ${netscript.formatRam(
      ramAmount
    )} of RAM...`
  );
  const newServerCost = netscript.getPurchasedServerCost(ramAmount);

  logWriter.writeLine('  Checking server farm for upgrade paths...');
  const purchaseOrders = new Array<ServerFarmOrder>();
  for (const hostname of farmHosts) {
    const maxRam = netscript.getServerMaxRam(hostname);
    const availableRam = getAvailableRam(netscript, hostname);
    const requiredRamUpgrade = nearestPowerOf2(
      maxRam + ramAmount - availableRam
    );
    const upgradeCost = netscript.getPurchasedServerUpgradeCost(
      hostname,
      requiredRamUpgrade
    );
    if (upgradeCost < newServerCost) {
      purchaseOrders.push({
        hostname: hostname,
        ramAmount: requiredRamUpgrade,
        cost: upgradeCost,
        purchaseFunc: netscript.upgradePurchasedServer,
      });
    }
  }
  purchaseOrders.sort((order1, order2) => order1.cost - order2.cost);
  logWriter.writeLine(`  Found ${purchaseOrders.length} server farm upgrades.`);

  logWriter.writeLine('  Determining available server purchases...');
  const requiredServers = serverCount - purchaseOrders.length;
  const availableServers = netscript.getPurchasedServerLimit();
  for (
    let serverCounter = 0;
    serverCounter < requiredServers && serverCounter < availableServers;
    serverCounter++
  ) {
    purchaseOrders.push({
      hostname: serverNamePrefix,
      ramAmount: ramAmount,
      cost: newServerCost,
      purchaseFunc: netscript.purchaseServer,
    });
  }
  logWriter.writeLine(
    `  Found ${purchaseOrders.length} server farm purchases.`
  );

  return purchaseOrders;
}

async function manageOrders(
  netscript: NS,
  logWriter: Logger,
  purchaseOrders: ServerFarmOrder[]
) {
  while (purchaseOrders.length > 0) {
    if (purchaseOrders[0].cost <= netscript.getPlayer().money) {
      const serverOrder = purchaseOrders.shift();
      if (!serverOrder) {
        break;
      }

      serverOrder.purchaseFunc(serverOrder.hostname, serverOrder.ramAmount);
      logWriter.writeLine(ENTRY_DIVIDER);
      logWriter.writeLine(
        `Purchased server farm order : ${
          serverOrder.hostname
        } - ${netscript.formatRam(
          serverOrder.ramAmount
        )} - $${netscript.formatNumber(serverOrder.cost)}`
      );
      logWriter.writeLine(`  Orders remaining : ${purchaseOrders.length}`);
    } else {
      await netscript.asleep(LOOP_DELAY_MILLISEC);
    }
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Server Farm Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const serverAmount = cmdArgs[CMD_FLAG_AMOUNT].valueOf() as number;
  const ramExponent = cmdArgs[CMD_FLAG_RAM_EXPONENT].valueOf() as number;
  const ramRequired = 2 ** ramExponent;
  const namePrefix = cmdArgs[CMD_FLAG_NAME_PREFIX].valueOf() as string;
  const excludeFarm = cmdArgs[CMD_FLAG_EXCLUDE_FARM].valueOf() as boolean;

  terminalWriter.writeLine(`Server Amount : ${serverAmount}`);
  terminalWriter.writeLine(`Ram Exponent : ${ramExponent}`);
  terminalWriter.writeLine(
    `Ram Required : ${netscript.formatRam(ramRequired)}`
  );
  terminalWriter.writeLine(`Name Prefix : ${namePrefix}`);
  terminalWriter.writeLine(`Exclude Farm : ${excludeFarm}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (serverAmount < 1) {
    terminalWriter.writeLine(
      `${CMD_FLAG_AMOUNT} command flag must be a positive number greater than 0.`
    );
    return;
  }
  if (ramExponent < 1 || ramExponent > 20) {
    terminalWriter.writeLine(
      `${CMD_FLAG_RAM_EXPONENT} command flag must be a positive number where 0 < x < 20.`
    );
    return;
  }

  const serverFarmHosts = netscript.getPurchasedServers();
  if (!excludeFarm) {
    const farmHostsWithRam = findServersForRam(
      netscript,
      ramRequired,
      ramRequired,
      false,
      serverFarmHosts
    );
    if (farmHostsWithRam.length >= serverAmount) {
      terminalWriter.writeLine(
        'Provided requirements are satisfied in current server farm :'
      );
      for (const hostname of farmHostsWithRam) {
        terminalWriter.writeLine(
          `  ${hostname} : ${netscript.formatRam(
            getAvailableRam(netscript, hostname)
          )}`
        );
      }
      return;
    }
  }

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const purchaseOrders = getOrders(
    netscript,
    scriptLogWriter,
    serverAmount,
    ramRequired,
    namePrefix,
    serverFarmHosts
  );
  if (serverAmount > purchaseOrders.length) {
    terminalWriter.writeLine(
      'Server farm is unable to satisfy the required resources.'
    );
    terminalWriter.writeLine(
      `Server farm is missing ${
        serverAmount - purchaseOrders.length
      } servers with ${netscript.formatRam(ramRequired)} of RAM.`
    );
    return;
  }
  terminalWriter.writeLine('See script logs for on-going purchase details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  scriptLogWriter.writeLine(
    `Purchasing ${purchaseOrders.length} server farm orders...`
  );
  await manageOrders(netscript, scriptLogWriter, purchaseOrders);
  const successMsg = `Server farm has satisfied the requested ${serverAmount} servers with ${netscript.formatRam(
    ramRequired
  )} of RAM!`;
  scriptLogWriter.writeLine(successMsg);
  terminalWriter.writeLine(successMsg);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_AMOUNT)) {
    return ['1', '2', '3', '5', '10', '15', '25'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_RAM_EXPONENT)) {
    return ['1', '2', '3', '5', '10', '15', '20'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_NAME_PREFIX)) {
    return [];
  }
  return CMD_FLAGS;
}
