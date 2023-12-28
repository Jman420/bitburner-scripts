import {CityName, CorpMaterialName, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';
import {openTail} from '/scripts/workflows/ui';
import {
  getOfficeLimitedProduction,
  waitForState,
} from '/scripts/workflows/corporation';

const MODULE_NAME = 'corp-supply';
const SUBSCRIBER_NAME = 'corp-supply';

export const TAIL_X_POS = 1230;
export const TAIL_Y_POS = 120;
export const TAIL_WIDTH = 1090;
export const TAIL_HEIGHT = 490;

const UPDATE_DELAY = 0;
const MAX_CONGESTION_COUNT = 5;

let officeProductionMap: Map<string, number>;
let warehouseCongestionMap: Map<string, number>;

function getOfficeKey(divisionName: string, cityName: CityName) {
  return `${divisionName}-${cityName}`;
}

function isWarehouseCongested(divisionName: string, cityName: CityName) {
  const officeKey = getOfficeKey(divisionName, cityName);
  const congestionCount = warehouseCongestionMap.get(officeKey) ?? 0;
  return congestionCount > MAX_CONGESTION_COUNT;
}

async function monitorOfficeProduction(netscript: NS, logWriter: Logger) {
  await waitForState(netscript, 'PURCHASE');

  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine('Monitoring Office Production');
  const corpApi = netscript.corporation;
  const corporationInfo = corpApi.getCorporation();
  for (const divisionName of corporationInfo.divisions) {
    const divisionInfo = corpApi.getDivision(divisionName);
    for (const officeCityName of divisionInfo.cities) {
      if (!corpApi.hasWarehouse(divisionName, officeCityName)) {
        continue;
      }

      const officeKey = getOfficeKey(divisionName, officeCityName);
      const officeProduction = getOfficeLimitedProduction(
        netscript,
        divisionName,
        officeCityName
      );
      officeProductionMap.set(officeKey, officeProduction);
      logWriter.writeLine(
        `  ${divisionName} - ${officeCityName} : ${officeProduction}`
      );
    }
  }
}

async function monitorWarehouseCongestion(netscript: NS, logWriter: Logger) {
  await waitForState(netscript, 'PRODUCTION');

  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine('Monitoring Warehouse Congestion');
  const corpApi = netscript.corporation;
  const corporationInfo = corpApi.getCorporation();
  for (const divisionName of corporationInfo.divisions) {
    const divisionInfo = corpApi.getDivision(divisionName);
    const industryInfo = corpApi.getIndustryData(divisionInfo.type);
    for (const officeCityName of divisionInfo.cities) {
      if (!corpApi.hasWarehouse(divisionName, officeCityName)) {
        continue;
      }

      let allOutputsProduced = true;
      for (const materialName of industryInfo.producedMaterials ?? []) {
        const materialInfo = corpApi.getMaterial(
          divisionName,
          officeCityName,
          materialName
        );
        allOutputsProduced =
          allOutputsProduced && materialInfo.productionAmount > 0;
      }
      for (const productName of divisionInfo.products) {
        const productInfo = corpApi.getProduct(
          divisionName,
          officeCityName,
          productName
        );
        allOutputsProduced =
          allOutputsProduced && productInfo.productionAmount > 0;
      }

      const officeInfo = corpApi.getOffice(divisionName, officeCityName);
      const productionWorkerCount =
        officeInfo.employeeJobs.Operations +
        officeInfo.employeeJobs.Engineer +
        officeInfo.employeeJobs.Management;

      const officeKey = getOfficeKey(divisionName, officeCityName);
      let congestionCount = 0;
      if (!allOutputsProduced && productionWorkerCount > 0) {
        congestionCount = warehouseCongestionMap.get(officeKey) ?? 0;
        congestionCount++;
      }
      warehouseCongestionMap.set(officeKey, congestionCount);
      logWriter.writeLine(
        `  ${divisionName} - ${officeCityName} : ${congestionCount}`
      );
    }
  }
}

async function manageWarehouse(netscript: NS, logWriter: Logger) {
  await waitForState(netscript, 'START');

  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine('Managing Warehouse Storage');
  const corpApi = netscript.corporation;
  const corporationInfo = corpApi.getCorporation();
  for (const divisionName of corporationInfo.divisions) {
    const divisionInfo = corpApi.getDivision(divisionName);
    const industryInfo = corpApi.getIndustryData(divisionInfo.type);
    for (const officeCityName of divisionInfo.cities) {
      if (!corpApi.hasWarehouse(divisionName, officeCityName)) {
        continue;
      }

      if (isWarehouseCongested(divisionName, officeCityName)) {
        logWriter.writeLine(
          `  ${divisionName} - ${officeCityName} : Congested`
        );
        for (const materialName of Object.keys(
          industryInfo.requiredMaterials
        )) {
          const materialInfo = corpApi.getMaterial(
            divisionName,
            officeCityName,
            materialName
          );
          const sellAmount = materialInfo.stored / 2;
          corpApi.sellMaterial(
            divisionName,
            officeCityName,
            materialName,
            `${sellAmount}`,
            '0'
          );
          corpApi.buyMaterial(divisionName, officeCityName, materialName, 0);
          logWriter.writeLine(`    ${materialName} - ${sellAmount}`);
        }
      } else {
        logWriter.writeLine(
          `  ${divisionName} - ${officeCityName} : Purchases`
        );
        const warehouseInfo = corpApi.getWarehouse(
          divisionName,
          officeCityName
        );
        const warehouseFreeSpace = warehouseInfo.size - warehouseInfo.sizeUsed;
        const officeKey = getOfficeKey(divisionName, officeCityName);
        const officeProduction = officeProductionMap.get(officeKey) ?? 0;
        let fewestOuputUnits = Number.MAX_VALUE;
        for (const [materialName, requiredCoefficient] of Object.entries(
          industryInfo.requiredMaterials
        )) {
          const productionRequiredAmount =
            officeProduction * requiredCoefficient;
          const materialData = corpApi.getMaterialData(
            materialName as CorpMaterialName
          );
          const maxAmount = warehouseFreeSpace / materialData.size;
          const limitedAmount = Math.max(
            0,
            Math.min(productionRequiredAmount, maxAmount)
          );
          const outputUnits = limitedAmount / requiredCoefficient;
          fewestOuputUnits = Math.min(fewestOuputUnits, outputUnits);
        }

        const inputMaterialAmounts = new Map<string, number>();
        let requiredSpace = 0;
        for (const [materialName, requiredCoefficient] of Object.entries(
          industryInfo.requiredMaterials
        )) {
          const materialInfo = corpApi.getMaterial(
            divisionName,
            officeCityName,
            materialName
          );
          const buyAmount = Math.max(
            0,
            fewestOuputUnits * requiredCoefficient - materialInfo.stored
          );
          inputMaterialAmounts.set(materialName, buyAmount);

          const materialData = corpApi.getMaterialData(
            materialName as CorpMaterialName
          );
          requiredSpace += buyAmount * materialData.size;
        }

        if (requiredSpace > warehouseFreeSpace) {
          const freeSpaceMultiplier = warehouseFreeSpace / requiredSpace;
          for (const [
            materialName,
            buyAmount,
          ] of inputMaterialAmounts.entries()) {
            inputMaterialAmounts.set(
              materialName,
              Math.floor(buyAmount * freeSpaceMultiplier)
            );
          }
        }

        for (const [
          materialName,
          buyAmount,
        ] of inputMaterialAmounts.entries()) {
          corpApi.buyMaterial(
            divisionName,
            officeCityName,
            materialName,
            buyAmount / 10
          );
          corpApi.sellMaterial(
            divisionName,
            officeCityName,
            materialName,
            '0',
            'MP'
          );
          logWriter.writeLine(`    ${materialName} - ${buyAmount}`);
        }
      }
    }
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporation Custom Smart Supply');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going supply details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const taskPromises = new Array<Promise<void>>();

  officeProductionMap = new Map<string, number>();
  taskPromises.push(
    delayedInfiniteLoop(
      netscript,
      UPDATE_DELAY,
      monitorOfficeProduction,
      netscript,
      scriptLogWriter
    )
  );

  warehouseCongestionMap = new Map<string, number>();
  taskPromises.push(
    delayedInfiniteLoop(
      netscript,
      UPDATE_DELAY,
      monitorWarehouseCongestion,
      netscript,
      scriptLogWriter
    )
  );

  taskPromises.push(
    delayedInfiniteLoop(
      netscript,
      UPDATE_DELAY,
      manageWarehouse,
      netscript,
      scriptLogWriter
    )
  );

  await Promise.all(taskPromises);
}
