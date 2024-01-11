import {AutocompleteData, CityName, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {openTail} from '/scripts/workflows/ui';

import {CITY_NAMES} from '/scripts/common/shared';

import {parseNumber} from '/scripts/workflows/parsing';
import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {waitForState} from '/scripts/workflows/corporation-actions';
import {
  FRAUD_DIVISION_NAME_PREFIX,
  ProductLifecycleConfig,
} from '/scripts/workflows/corporation-shared';
import {getDivisionProductLimit} from '/scripts/workflows/corporation-formulas';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {ProductLifecycleConfigEvent} from '/scripts/comms/events/product-lifecycle-config-event';
import {ProductLifecycleConfigRequest} from '/scripts/comms/requests/product-lifecycle-config-request';
import {ProductLifecycleConfigResponse} from '/scripts/comms/responses/product-lifecycle-config-response';
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

const DEFAULT_DESIGN_CITY = 'Sector-12';
const DEFAULT_PRODUCT_NAME = 'Product';
const DEFAULT_BUDGET_PERCENT = '0.01';

const PRODUCT_VERSION_SUFFIX = ' v';

export const CMD_FLAG_DIVISION_NAME = 'division';
export const CMD_FLAG_DESIGN_CITY_NAME = 'designCity';
export const CMD_FLAG_PRODUCT_NAME = 'productName';
export const CMD_FLAG_BUDGET_PERCENT = 'budgetPercent';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_DIVISION_NAME, ''],
  [CMD_FLAG_DESIGN_CITY_NAME, DEFAULT_DESIGN_CITY],
  [CMD_FLAG_PRODUCT_NAME, DEFAULT_PRODUCT_NAME],
  [CMD_FLAG_BUDGET_PERCENT, DEFAULT_BUDGET_PERCENT],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-product';
const SUBSCRIBER_NAME = 'corp-product';

const TAIL_X_POS = 1230;
const TAIL_Y_POS = 120;
const TAIL_WIDTH = 1090;
const TAIL_HEIGHT = 490;

const UPDATE_DELAY = 0;

let DIVISION_NAMES: string[];
let managerConfig: ProductLifecycleConfig;

async function manageProductLifecycle(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  let productVersion = 0;
  const corpApi = nsLocator.corporation;
  const corporationInfo = await corpApi['getCorporation']();
  const divisionInfo = await corpApi['getDivision'](managerConfig.divisionName);
  for (const productName of divisionInfo.products) {
    const productInfo = await corpApi['getProduct'](
      managerConfig.divisionName,
      managerConfig.designCity,
      productName
    );
    if (productInfo.developmentProgress < 100) {
      await waitForState(netscript, 'START');
      return;
    }

    const productVersionIndex = productName.indexOf(PRODUCT_VERSION_SUFFIX);
    if (productVersionIndex > -1) {
      productVersion = parseInt(
        productName.slice(productVersionIndex + PRODUCT_VERSION_SUFFIX.length)
      );
    }
  }
  productVersion++;

  const productLimit = await getDivisionProductLimit(
    nsLocator,
    managerConfig.divisionName
  );
  if (divisionInfo.products.length >= productLimit) {
    const eolProductName = divisionInfo.products[0];
    logWriter.writeLine(
      `Discontinuing product in division ${managerConfig.divisionName} : ${eolProductName}`
    );
    await corpApi['discontinueProduct'](
      managerConfig.divisionName,
      eolProductName
    );
  }

  const newProductName = `${managerConfig.productName}${PRODUCT_VERSION_SUFFIX}${productVersion}`;
  const budget = corporationInfo.funds * managerConfig.budgetPercent;
  logWriter.writeLine(
    `Designing new product in division ${
      managerConfig.divisionName
    } : ${newProductName} with design & marketing budgets : $${netscript.formatNumber(
      budget
    )}`
  );
  await corpApi['makeProduct'](
    managerConfig.divisionName,
    managerConfig.designCity,
    newProductName,
    budget,
    budget
  );

  await waitForState(netscript, 'START');
}

function handleUpdateConfigEvent(
  eventData: ProductLifecycleConfigEvent,
  netscript: NS,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  managerConfig = eventData.config;
  if (!managerConfig.productName) {
    managerConfig.productName = DEFAULT_PRODUCT_NAME;
  }
  if (managerConfig.budgetPercent < 0) {
    managerConfig.budgetPercent = parseNumber(DEFAULT_BUDGET_PERCENT);
  }

  logWriter.writeLine(`Division Name : ${managerConfig.divisionName}`);
  logWriter.writeLine(`Design City : ${managerConfig.designCity}`);
  logWriter.writeLine(`Product Name : ${managerConfig.productName}`);
  logWriter.writeLine(
    `Budget Percent : $${netscript.formatPercent(managerConfig.budgetPercent)}`
  );
}

function handleProductLifecycleConfigRequest(
  requestData: ProductLifecycleConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending product lifecycle config response to ${requestData.sender}`
  );
  sendMessage(
    new ProductLifecycleConfigResponse(managerConfig),
    requestData.sender
  );
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  const corpInfo = await nsLocator.corporation['getCorporation']();
  DIVISION_NAMES = corpInfo.divisions
    .filter(value => !value.includes(FRAUD_DIVISION_NAME_PREFIX))
    .map(value => `'${value}'`);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporation Product Lifecycle Manager');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const divisionName = cmdArgs[CMD_FLAG_DIVISION_NAME].valueOf() as string;
  const designCity = cmdArgs[CMD_FLAG_DESIGN_CITY_NAME].valueOf() as CityName;
  const productName = cmdArgs[CMD_FLAG_PRODUCT_NAME].valueOf() as string;
  const budgetPercent = parseNumber(
    cmdArgs[CMD_FLAG_BUDGET_PERCENT].valueOf() as string
  );

  terminalWriter.writeLine(`Division Name : ${divisionName}`);
  terminalWriter.writeLine(`Design City : ${designCity}`);
  terminalWriter.writeLine(`Product Name : ${productName}`);
  terminalWriter.writeLine(
    `Budget Percent : $${netscript.formatPercent(budgetPercent)}`
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
  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(
    ProductLifecycleConfigEvent,
    handleUpdateConfigEvent,
    netscript,
    scriptLogWriter
  );
  eventListener.addListener(
    ProductLifecycleConfigRequest,
    handleProductLifecycleConfigRequest,
    scriptLogWriter
  );

  scriptLogWriter.writeLine('Corporation Product Lifecycle Manager');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  scriptLogWriter.writeLine(`Division Name : ${divisionName}`);
  scriptLogWriter.writeLine(`Design City : ${designCity}`);
  scriptLogWriter.writeLine(`Product Name : ${productName}`);
  scriptLogWriter.writeLine(
    `Budget Percent : $${netscript.formatPercent(budgetPercent)}`
  );
  scriptLogWriter.writeLine(SECTION_DIVIDER);

  managerConfig = {
    divisionName: divisionName,
    designCity: designCity,
    productName: productName,
    budgetPercent: budgetPercent,
  };

  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    manageProductLifecycle,
    nsPackage,
    scriptLogWriter
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
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_BUDGET_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
