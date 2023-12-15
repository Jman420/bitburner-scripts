import {AutocompleteData, CityName, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {openTail} from '/scripts/workflows/ui';
import {CITY_NAMES} from '/scripts/common/shared';
import {
  getDivisionProductLimit,
  waitForState,
} from '/scripts/workflows/corporation';
import {parseNumber} from '/scripts/workflows/parsing';

const PRODUCT_VERSION_SUFFIX = ' v';

const CMD_FLAG_DIVISION_NAME = 'division';
const CMD_FLAG_DESIGN_CITY_NAME = 'designCity';
const CMD_FLAG_PRODUCT_NAME = 'productName';
const CMD_FLAG_DESIGN_BUDGET = 'designBudget';
const CMD_FLAG_MARKETING_BUDGET = 'marketingBudget';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_DIVISION_NAME, ''],
  [CMD_FLAG_DESIGN_CITY_NAME, 'Sector-12'],
  [CMD_FLAG_PRODUCT_NAME, 'Product'],
  [CMD_FLAG_DESIGN_BUDGET, '5b'],
  [CMD_FLAG_MARKETING_BUDGET, '5b'],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const BUDGET_AUTOCOMPLETE = ['1b', '5b', '10b', '15b'];

const MODULE_NAME = 'corp-product';
const SUBSCRIBER_NAME = 'corp-product';

const TAIL_X_POS = 1230;
const TAIL_Y_POS = 120;
const TAIL_WIDTH = 1090;
const TAIL_HEIGHT = 490;

const UPDATE_DELAY = 0;

let DIVISION_NAMES: string[];

async function manageProductLifecycle(
  netscript: NS,
  logWriter: Logger,
  divisionName: string,
  designCity: CityName,
  productName: string,
  designBudget: number,
  marketingBudget: number
) {
  let productVersion = 1;
  const divisionInfo = netscript.corporation.getDivision(divisionName);
  for (const productName of divisionInfo.products) {
    const productInfo = netscript.corporation.getProduct(
      divisionName,
      designCity,
      productName
    );
    if (productInfo.developmentProgress < 100) {
      await waitForState(netscript, 'START');
      return;
    }

    const productVersionIndex =
      productName.indexOf(PRODUCT_VERSION_SUFFIX) +
      PRODUCT_VERSION_SUFFIX.length;
    if (productVersionIndex >= PRODUCT_VERSION_SUFFIX.length) {
      productVersion = parseInt(productName.slice(productVersionIndex));
    }
  }

  const productLimit = getDivisionProductLimit(netscript, divisionName);
  if (divisionInfo.products.length >= productLimit) {
    const eolProductName = divisionInfo.products[0];
    logWriter.writeLine(
      `Discontinuing product in division ${divisionName} : ${eolProductName}`
    );
    netscript.corporation.discontinueProduct(divisionName, eolProductName);
  }

  const newProductName = `${productName}${PRODUCT_VERSION_SUFFIX}${productVersion}`;
  logWriter.writeLine(
    `Designing new product in division ${divisionName} : ${newProductName}`
  );
  netscript.corporation.makeProduct(
    divisionName,
    designCity,
    newProductName,
    designBudget,
    marketingBudget
  );

  await waitForState(netscript, 'START');
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  DIVISION_NAMES = netscript.corporation
    .getCorporation()
    .divisions.map(value => `'${value}'`);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporation Product Lifecycle Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const divisionName = cmdArgs[CMD_FLAG_DIVISION_NAME].valueOf() as string;
  const designCity = cmdArgs[CMD_FLAG_DESIGN_CITY_NAME].valueOf() as CityName;
  const productName = cmdArgs[CMD_FLAG_PRODUCT_NAME].valueOf() as string;
  const designBudget = parseNumber(
    cmdArgs[CMD_FLAG_DESIGN_BUDGET].valueOf() as string
  );
  const marketingBudget = parseNumber(
    cmdArgs[CMD_FLAG_MARKETING_BUDGET].valueOf() as string
  );

  terminalWriter.writeLine(`Division Name : ${divisionName}`);
  terminalWriter.writeLine(`Design City : ${designCity}`);
  terminalWriter.writeLine(`Product Name : ${productName}`);
  terminalWriter.writeLine(
    `Design Budget : $${netscript.formatNumber(designBudget)}`
  );
  terminalWriter.writeLine(
    `Marketing Budget : $${netscript.formatNumber(marketingBudget)}`
  );
  terminalWriter.writeLine(SECTION_DIVIDER);

  if (!divisionName) {
    terminalWriter.writeLine('No division name provided.');
    terminalWriter.writeLine(SECTION_DIVIDER);
    terminalWriter.writeLine('Available divisions : ');
    for (const divisionName of DIVISION_NAMES) {
      terminalWriter.writeLine(`  ${divisionName}`);
    }
    return;
  }

  terminalWriter.writeLine(
    'See script logs for on-going product lifecycle details.'
  );
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    manageProductLifecycle,
    netscript,
    scriptLogWriter,
    divisionName,
    designCity,
    productName,
    designBudget,
    marketingBudget
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_DIVISION_NAME)) {
    if (!DIVISION_NAMES || DIVISION_NAMES.length < 1) {
      return ['Run script to initialize Division Names!'];
    }

    return DIVISION_NAMES;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_DESIGN_CITY_NAME)) {
    return CITY_NAMES.map(value => `'${value}'`);
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_DESIGN_BUDGET)) {
    return BUDGET_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MARKETING_BUDGET)) {
    return BUDGET_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
