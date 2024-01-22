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
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

const MODULE_NAME = 'corp-price';
const SUBSCRIBER_NAME = 'corp-price';

export const TAIL_X_POS = 425;
export const TAIL_Y_POS = 1000;
export const TAIL_WIDTH = 825;
export const TAIL_HEIGHT = 345;

const UPDATE_DELAY = 0;

let productMarkupCache: Map<string, number>;

async function purgeProductMarkupCache(nsPackage: NetscriptPackage) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  await waitForState(netscript, CorpState.START);

  for (const productKey of productMarkupCache.keys()) {
    const productKeyInfo = productKey.split('|');
    const divisionName = productKeyInfo[0];
    const productName = productKeyInfo[2];

    const divisionInfo =
      await nsLocator.corporation['getDivision'](divisionName);
    if (!divisionInfo.products.includes(productName)) {
      productMarkupCache.delete(productKey);
    }
  }
}

async function manageOutputPricing(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  await waitForState(netscript, CorpState.EXPORT);

  logWriter.writeLine('Setting up output pricing...');
  const corpApi = nsLocator.corporation;
  const corporationInfo = await corpApi['getCorporation']();
  for (const divisionName of corporationInfo.divisions.filter(
    value => !value.includes(FRAUD_DIVISION_NAME_PREFIX)
  )) {
    logWriter.writeLine(`  Division : ${divisionName} ...`);
    const divisionInfo = await corpApi['getDivision'](divisionName);
    const industryInfo = await corpApi['getIndustryData'](divisionInfo.type);

    for (const cityName of divisionInfo.cities) {
      logWriter.writeLine(`    City : ${cityName}`);
      for (const producedMaterial of industryInfo.producedMaterials ?? []) {
        const materialInfo = await corpApi['getMaterial'](
          divisionName,
          cityName,
          producedMaterial
        );
        const optimalPrice = await getOptimalSellingPrice(
          nsLocator,
          divisionName,
          cityName,
          materialInfo
        );
        const optimalPriceString = optimalPrice
          ? optimalPrice.toString()
          : 'MP';
        await corpApi['sellMaterial'](
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
        const productInfo = await corpApi['getProduct'](
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
            nsLocator,
            divisionName,
            cityName,
            productInfo
          );
          productMarkupCache.set(productKey, productMarkup);
        }

        const optimalPrice = await getOptimalSellingPrice(
          nsLocator,
          divisionName,
          cityName,
          productInfo,
          productMarkup
        );
        const optimalPriceString = optimalPrice
          ? optimalPrice.toString()
          : 'MP';
        await corpApi['sellProduct'](
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
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporate Pricing Setup');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for export setup details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  productMarkupCache = new Map<string, number>();
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const taskPromises = [];
  taskPromises.push(
    delayedInfiniteLoop(
      netscript,
      UPDATE_DELAY,
      manageOutputPricing,
      nsPackage,
      scriptLogWriter
    )
  );
  taskPromises.push(
    delayedInfiniteLoop(
      netscript,
      UPDATE_DELAY,
      purgeProductMarkupCache,
      nsPackage
    )
  );
  await Promise.allSettled(taskPromises);
}
