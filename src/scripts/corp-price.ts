import {NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {openTail} from '/scripts/workflows/ui';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';

import {CorpState} from '/scripts/data/corporation-enums';
import {FRAUD_DIVISION_NAME_PREFIX} from '/scripts/workflows/corporation-shared';
import {waitForState} from '/scripts/workflows/corporation-actions';
import {
  getOptimalProductMarkup,
  getOptimalSellingPrice,
} from '/scripts/workflows/corporation-optimization';

const MODULE_NAME = 'corp-price';
const SUBSCRIBER_NAME = 'corp-price';

export const TAIL_X_POS = 1230;
export const TAIL_Y_POS = 120;
export const TAIL_WIDTH = 1090;
export const TAIL_HEIGHT = 490;

const UPDATE_DELAY = 0;

let productMarkupCache: Map<string, number>;

async function purgeProductMarkupCache(netscript: NS) {
  await waitForState(netscript, CorpState.START);

  for (const productKey of productMarkupCache.keys()) {
    const productKeyInfo = productKey.split('|');
    const divisionName = productKeyInfo[0];
    const productName = productKeyInfo[2];

    const divisionInfo = netscript.corporation.getDivision(divisionName);
    if (!divisionInfo.products.includes(productName)) {
      productMarkupCache.delete(productKey);
    }
  }
}

async function manageOutputPricing(netscript: NS, logWriter: Logger) {
  await waitForState(netscript, CorpState.EXPORT);

  logWriter.writeLine('Setting up output pricing...');
  const corpApi = netscript.corporation;
  const corporationInfo = corpApi.getCorporation();
  for (const divisionName of corporationInfo.divisions.filter(
    value => !value.includes(FRAUD_DIVISION_NAME_PREFIX)
  )) {
    logWriter.writeLine(`  Division : ${divisionName} ...`);
    const divisionInfo = corpApi.getDivision(divisionName);
    const industryInfo = netscript.corporation.getIndustryData(
      divisionInfo.type
    );

    for (const cityName of divisionInfo.cities) {
      logWriter.writeLine(`    City : ${cityName}`);
      for (const producedMaterial of industryInfo.producedMaterials ?? []) {
        const materialInfo = corpApi.getMaterial(
          divisionName,
          cityName,
          producedMaterial
        );
        const optimalPrice = await getOptimalSellingPrice(
          netscript,
          divisionName,
          cityName,
          materialInfo
        );
        const optimalPriceString = optimalPrice
          ? optimalPrice.toString()
          : 'MP';
        corpApi.sellMaterial(
          divisionName,
          cityName,
          producedMaterial,
          'MAX',
          optimalPriceString
        );

        const logPrice = optimalPrice
          ? netscript.formatNumber(optimalPrice)
          : 'MP';
        logWriter.writeLine(
          `      Material : ${producedMaterial} - $${logPrice}`
        );
      }
      for (const producedProduct of divisionInfo.products) {
        const productInfo = corpApi.getProduct(
          divisionName,
          cityName,
          producedProduct
        );
        if (productInfo.developmentProgress < 100) {
          continue;
        }

        const productKey = `${divisionName}|${cityName}|${producedProduct}`;
        let productMarkup = productMarkupCache.get(productKey);
        if (!productMarkup) {
          productMarkup = await getOptimalProductMarkup(
            netscript,
            divisionName,
            cityName,
            productInfo
          );
          productMarkupCache.set(productKey, productMarkup);
        }

        const optimalPrice = getOptimalSellingPrice(
          netscript,
          divisionName,
          cityName,
          productInfo,
          productMarkup
        );
        const optimalPriceString = optimalPrice
          ? optimalPrice.toString()
          : 'MP';
        corpApi.sellProduct(
          divisionName,
          cityName,
          producedProduct,
          'MAX',
          optimalPriceString,
          false
        );

        const logPrice = optimalPrice
          ? netscript.formatNumber(optimalPrice)
          : 'MP';
        logWriter.writeLine(
          `      Product : ${producedProduct} - $${logPrice}`
        );
      }
    }
  }
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporate Pricing Setup');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for export setup details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  productMarkupCache = new Map<string, number>();
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const taskPromises = new Array<Promise<void>>();
  taskPromises.push(
    delayedInfiniteLoop(
      netscript,
      UPDATE_DELAY,
      manageOutputPricing,
      netscript,
      scriptLogWriter
    )
  );
  taskPromises.push(
    delayedInfiniteLoop(
      netscript,
      UPDATE_DELAY,
      purgeProductMarkupCache,
      netscript
    )
  );
  await Promise.allSettled(taskPromises);
}
