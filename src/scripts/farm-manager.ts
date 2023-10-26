import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  BOOLEAN_AUTOCOMPLETE,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {findServersForRam, getAvailableRam} from '/scripts/workflows/recon';
import {ServerFarmOrder, nearestPowerOf2} from '/scripts/workflows/server-farm';

const CMD_FLAG_AMOUNT = 'amount';
const CMD_FLAG_RAM_EXPONENT = 'ramExponent';
const CMD_FLAG_NAME_PREFIX = 'namePrefix';
const CMD_FLAG_EXCLUDE_FARM = 'excludeFarm';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_AMOUNT, 0],
  [CMD_FLAG_RAM_EXPONENT, 0],
  [CMD_FLAG_NAME_PREFIX, 'server-node'],
  [CMD_FLAG_EXCLUDE_FARM, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const LOOP_DELAY_MILLISEC = 5000;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'farm-manager', LoggerMode.TERMINAL);
  logWriter.writeLine('Server Farm Manager');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const serverAmount = cmdArgs[CMD_FLAG_AMOUNT].valueOf() as number;
  const ramExponent = cmdArgs[CMD_FLAG_RAM_EXPONENT].valueOf() as number;
  const ramRequired = 2 ** ramExponent;
  const namePrefix = cmdArgs[CMD_FLAG_NAME_PREFIX].valueOf() as string;
  const excludeFarm = cmdArgs[CMD_FLAG_EXCLUDE_FARM].valueOf() as boolean;

  logWriter.writeLine(`Server Amount : ${serverAmount}`);
  logWriter.writeLine(`Ram Exponent : ${ramExponent}`);
  logWriter.writeLine(`Ram Required : ${ramRequired}`);
  logWriter.writeLine(`Name Prefix : ${namePrefix}`);
  logWriter.writeLine(`Exclude Farm : ${excludeFarm}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (serverAmount < 1) {
    logWriter.writeLine(
      `${CMD_FLAG_AMOUNT} command flag must be a positive number greater than 0.`
    );
    return;
  }
  if (ramExponent < 1 || ramExponent > 20) {
    logWriter.writeLine(
      `${CMD_FLAG_RAM_EXPONENT} command flag must be a positive number where 0 < x < 20.`
    );
    return;
  }

  const serverFarmHosts = netscript.getPurchasedServers();
  if (!excludeFarm) {
    logWriter.writeLine(
      `Checking server farm for ${serverAmount} servers with ${ramRequired}GB of RAM available...`
    );
    const farmHostsWithRam = findServersForRam(
      netscript,
      ramRequired,
      ramRequired,
      false,
      serverFarmHosts
    );
    if (farmHostsWithRam.length >= serverAmount) {
      logWriter.writeLine(
        'Provided requirements are satisfied in current server farm :'
      );
      for (const hostname of farmHostsWithRam) {
        logWriter.writeLine(
          `  ${hostname} : ${getAvailableRam(netscript, hostname)}`
        );
      }
      return;
    }
  }

  logWriter.writeLine(
    `Determining cheapest purchase path for ${serverAmount} servers with ${ramRequired}GB of RAM...`
  );
  const newServerCost = netscript.getPurchasedServerCost(ramRequired);

  logWriter.writeLine('  Checking server farm for upgrade paths...');
  const purchaseOrders = new Array<ServerFarmOrder>();
  for (const hostname of serverFarmHosts) {
    const maxRam = netscript.getServerMaxRam(hostname);
    const availableRam = getAvailableRam(netscript, hostname);
    const requiredRamUpgrade = nearestPowerOf2(
      maxRam + ramRequired - availableRam
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
  const requiredServers = serverAmount - purchaseOrders.length;
  const availableServers = netscript.getPurchasedServerLimit();
  for (
    let serverCounter = 0;
    serverCounter < requiredServers && serverCounter < availableServers;
    serverCounter++
  ) {
    purchaseOrders.push({
      hostname: namePrefix,
      ramAmount: ramRequired,
      cost: newServerCost,
      purchaseFunc: netscript.purchaseServer,
    });
  }
  logWriter.writeLine(
    `  Found ${purchaseOrders.length} server farm purchases.`
  );
  logWriter.writeLine(SECTION_DIVIDER);

  if (serverAmount > purchaseOrders.length) {
    logWriter.writeLine(
      'Server farm is unable to satisfy the required resources.'
    );
    logWriter.writeLine(
      `Server farm is missing ${
        serverAmount - purchaseOrders.length
      } servers with ${ramRequired}GB of RAM.`
    );
    return;
  }

  logWriter.writeLine(
    `Purchasing ${purchaseOrders.length} server farm orders...`
  );
  while (purchaseOrders.length > 0) {
    if (purchaseOrders[0].cost <= netscript.getPlayer().money) {
      const upgradeOrder = purchaseOrders.shift();
      if (!upgradeOrder) {
        break;
      }

      netscript.upgradePurchasedServer(
        upgradeOrder?.hostname,
        upgradeOrder?.ramAmount
      );
    } else {
      await netscript.sleep(LOOP_DELAY_MILLISEC);
    }
  }
  logWriter.writeLine(
    `Server farm has satisfied the requested ${serverAmount} servers with ${ramRequired}GB of RAM!`
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_AMOUNT)) {
    return ['1', '2', '3', '5', '10', '15', '25'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_RAM_EXPONENT)) {
    return ['1', '2', '3', '5', '10', '15', '20'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_EXCLUDE_FARM)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
