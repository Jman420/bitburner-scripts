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
  ProductLifecycleConfig,
  getDivisionProductLimit,
  setProductMarketTA,
  waitForState,
} from '/scripts/workflows/corporation';
import {parseNumber} from '/scripts/workflows/parsing';
import {ProductLifecycleConfigEvent} from '/scripts/comms/events/product-lifecycle-config-event';
import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {ProductLifecycleConfigRequest} from '/scripts/comms/requests/product-lifecycle-config-request';
import {ProductLifecycleConfigResponse} from '/scripts/comms/responses/product-lifecycle-config-response';

const DEFAULT_DESIGN_CITY = 'Sector-12';
const DEFAULT_PRODUCT_NAME = 'Product';
const DEFAULT_DESIGN_BUDGET = '5b';
const DEFAULT_MARKETING_BUDGET = '5b';

const PRODUCT_VERSION_SUFFIX = ' v';

export const CMD_FLAG_DIVISION_NAME = 'division';
export const CMD_FLAG_DESIGN_CITY_NAME = 'designCity';
export const CMD_FLAG_PRODUCT_NAME = 'productName';
export const CMD_FLAG_DESIGN_BUDGET = 'designBudget';
export const CMD_FLAG_MARKETING_BUDGET = 'marketingBudget';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_DIVISION_NAME, ''],
  [CMD_FLAG_DESIGN_CITY_NAME, DEFAULT_DESIGN_CITY],
  [CMD_FLAG_PRODUCT_NAME, DEFAULT_PRODUCT_NAME],
  [CMD_FLAG_DESIGN_BUDGET, DEFAULT_DESIGN_BUDGET],
  [CMD_FLAG_MARKETING_BUDGET, DEFAULT_MARKETING_BUDGET],
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
let managerConfig: ProductLifecycleConfig;

async function manageProductLifecycle(netscript: NS, logWriter: Logger) {
  let productVersion = 0;
  const divisionInfo = netscript.corporation.getDivision(
    managerConfig.divisionName
  );
  for (const productName of divisionInfo.products) {
    const productInfo = netscript.corporation.getProduct(
      managerConfig.divisionName,
      managerConfig.designCity,
      productName
    );
    if (productInfo.developmentProgress < 100) {
      await waitForState(netscript, 'START');
      return;
    }

    setProductMarketTA(netscript, managerConfig.divisionName, productName);

    const productVersionIndex = productName.indexOf(PRODUCT_VERSION_SUFFIX);
    if (productVersionIndex > -1) {
      productVersion = parseInt(
        productName.slice(productVersionIndex + PRODUCT_VERSION_SUFFIX.length)
      );
    }
  }
  productVersion++;

  const productLimit = getDivisionProductLimit(
    netscript,
    managerConfig.divisionName
  );
  if (divisionInfo.products.length >= productLimit) {
    const eolProductName = divisionInfo.products[0];
    logWriter.writeLine(
      `Discontinuing product in division ${managerConfig.divisionName} : ${eolProductName}`
    );
    netscript.corporation.discontinueProduct(
      managerConfig.divisionName,
      eolProductName
    );
  }

  const newProductName = `${managerConfig.productName}${PRODUCT_VERSION_SUFFIX}${productVersion}`;
  logWriter.writeLine(
    `Designing new product in division ${managerConfig.divisionName} : ${newProductName}`
  );
  netscript.corporation.makeProduct(
    managerConfig.divisionName,
    managerConfig.designCity,
    newProductName,
    managerConfig.designBudget,
    managerConfig.marketingBudget
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
  if (managerConfig.designBudget < 0) {
    managerConfig.designBudget = parseNumber(DEFAULT_DESIGN_BUDGET);
  }
  if (managerConfig.marketingBudget < 0) {
    managerConfig.marketingBudget = parseNumber(DEFAULT_MARKETING_BUDGET);
  }

  logWriter.writeLine(`Division Name : ${managerConfig.divisionName}`);
  logWriter.writeLine(`Design City : ${managerConfig.designCity}`);
  logWriter.writeLine(`Product Name : ${managerConfig.productName}`);
  logWriter.writeLine(
    `Design Budget : $${netscript.formatNumber(managerConfig.designBudget)}`
  );
  logWriter.writeLine(
    `Marketing Budget : $${netscript.formatNumber(
      managerConfig.marketingBudget
    )}`
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
    `Design Budget : $${netscript.formatNumber(designBudget)}`
  );
  scriptLogWriter.writeLine(
    `Marketing Budget : $${netscript.formatNumber(marketingBudget)}`
  );
  scriptLogWriter.writeLine(SECTION_DIVIDER);

  managerConfig = {
    divisionName: divisionName,
    designCity: designCity,
    productName: productName,
    designBudget: designBudget,
    marketingBudget: marketingBudget,
  };

  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    manageProductLifecycle,
    netscript,
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
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_DESIGN_BUDGET)) {
    return BUDGET_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MARKETING_BUDGET)) {
    return BUDGET_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
