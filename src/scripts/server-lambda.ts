import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {openTail} from '/scripts/workflows/ui';

import {initializeScript} from '/scripts/workflows/execution';
import {NETSCRIPT_SERVER_NAME} from '/scripts/common/shared';
import {ServerFarmOrder, nearestPowerOf2} from '/scripts/workflows/server-farm';
import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';

const DEFAULT_RAM_AMOUNT = 1024;
const CMD_FLAG_RAM_AMOUNT = 'ramAmount';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_RAM_AMOUNT, DEFAULT_RAM_AMOUNT],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'server-lambda';
const SUBSCRIBER_NAME = 'server-lambda';

const TAIL_X_POS = 1500;
const TAIL_Y_POS = 86;
const TAIL_WIDTH = 820;
const TAIL_HEIGHT = 380;

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Server Farm - Lambda Server Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const requestedRam = cmdArgs[CMD_FLAG_RAM_AMOUNT].valueOf() as number;
  const ramAmount = nearestPowerOf2(requestedRam);

  terminalWriter.writeLine(`Requested Ram : ${requestedRam}`);
  terminalWriter.writeLine(`Ram Amount : ${ramAmount}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  let purchaseOrder: ServerFarmOrder;
  if (netscript.serverExists(NETSCRIPT_SERVER_NAME)) {
    const maxRam = netscript.getServerMaxRam(NETSCRIPT_SERVER_NAME);
    if (maxRam >= ramAmount) {
      terminalWriter.writeLine(
        `Lambda server already satisfied ram requirement : ${netscript.formatRam(
          maxRam
        )}`
      );
      return;
    }

    const requiredRam = ramAmount - maxRam;
    purchaseOrder = {
      hostname: NETSCRIPT_SERVER_NAME,
      ramAmount: nearestPowerOf2(requiredRam),
      cost: netscript.getPurchasedServerUpgradeCost(
        NETSCRIPT_SERVER_NAME,
        requiredRam
      ),
      purchaseFunc: netscript.upgradePurchasedServer,
    };
  } else {
    purchaseOrder = {
      hostname: NETSCRIPT_SERVER_NAME,
      ramAmount: ramAmount,
      cost: netscript.getPurchasedServerCost(ramAmount),
      purchaseFunc: nsLocator['purchaseServer'],
    };
  }

  terminalWriter.writeLine('See script logs for on-going purchase details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  scriptLogWriter.writeLine('Pending purchase order :');
  scriptLogWriter.writeLine(`  Hostname : ${purchaseOrder.hostname}`);
  scriptLogWriter.writeLine(`  Ram Amount : ${purchaseOrder.ramAmount}`);
  scriptLogWriter.writeLine(
    `  Cost : $${netscript.formatNumber(purchaseOrder.cost)}`
  );
  scriptLogWriter.writeLine(`  Purchase Func : ${purchaseOrder.purchaseFunc}`);

  scriptLogWriter.writeLine(
    'Waitings for sufficient funds to make purchase...'
  );
  while (netscript.getPlayer().money < purchaseOrder.cost) {
    await netscript.asleep(500);
  }

  scriptLogWriter.writeLine('Purchasing order...');
  await purchaseOrder.purchaseFunc(
    NETSCRIPT_SERVER_NAME,
    purchaseOrder.ramAmount
  );
  scriptLogWriter.writeLine('Lambda server successfully upgraded!');
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_RAM_AMOUNT)) {
    return [512, DEFAULT_RAM_AMOUNT, 2048];
  }
  return CMD_FLAGS;
}
