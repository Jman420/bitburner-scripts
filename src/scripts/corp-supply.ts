import {CityName, CorpMaterialName, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {openTail} from '/scripts/workflows/ui';

import {waitForState} from '/scripts/workflows/corporation-actions';
import {getOfficeLimitedProduction} from '/scripts/workflows/corporation-formulas';
import {ExitEvent} from '/scripts/comms/events/exit-event';
import {sendMessage} from '/scripts/comms/event-comms';
import {
  NetscriptLocator,
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';
import {infiniteLoop} from '/scripts/workflows/execution';

const MODULE_NAME = 'corp-supply';
const SUBSCRIBER_NAME = 'corp-supply';

export const TAIL_X_POS = 520;
export const TAIL_Y_POS = 965;
export const TAIL_WIDTH = 805;
export const TAIL_HEIGHT = 380;

const MAX_CONGESTION_COUNT = 5;

let officeProductionMap: Map<string, number>;
let warehouseCongestionMap: Map<string, number>;

async function handleShutdown(nsLocator: NetscriptLocator) {
  const corpApi = nsLocator.corporation;
  const corporationInfo = await corpApi['getCorporation']();
  for (const divisionName of corporationInfo.divisions) {
    const divisionInfo = await corpApi['getDivision'](divisionName);
    const industryInfo = await corpApi['getIndustryData'](divisionInfo.type);
    for (const officeCityName of divisionInfo.cities) {
      for (const materialName of Object.keys(industryInfo.requiredMaterials)) {
        await corpApi['buyMaterial'](
          divisionName,
          officeCityName,
          materialName,
          0
        );
        await corpApi['sellMaterial'](
          divisionName,
          officeCityName,
          materialName,
          '0',
          'MP'
        );
      }
    }
  }
}

function getOfficeKey(divisionName: string, cityName: CityName) {
  return `${divisionName}-${cityName}`;
}

function isWarehouseCongested(officeKey: string) {
  const congestionCount = warehouseCongestionMap.get(officeKey) ?? 0;
  return congestionCount > MAX_CONGESTION_COUNT;
}

async function monitorOfficeProduction(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  await waitForState(netscript, 'PURCHASE');

  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine('Monitoring Office Production');
  const corpApi = nsLocator.corporation;
  const corporationInfo = await corpApi['getCorporation']();
  for (const divisionName of corporationInfo.divisions) {
    const divisionInfo = await corpApi['getDivision'](divisionName);
    const industryInfo = await corpApi['getIndustryData'](divisionInfo.type);
    for (const officeCityName of divisionInfo.cities) {
      const officeInfo = await corpApi['getOffice'](
        divisionName,
        officeCityName
      );
      if (
        !(await corpApi['hasWarehouse'](divisionName, officeCityName)) ||
        officeInfo.numEmployees < 1
      ) {
        continue;
      }

      const officeKey = getOfficeKey(divisionName, officeCityName);
      let officeProduction = 0;
      if (industryInfo.makesMaterials) {
        officeProduction += await getOfficeLimitedProduction(
          nsLocator,
          divisionName,
          officeCityName
        );
      }
      if (industryInfo.makesProducts) {
        for (const productName of divisionInfo.products) {
          const productInfo = await corpApi['getProduct'](
            divisionName,
            officeCityName,
            productName
          );
          if (productInfo.developmentProgress >= 100) {
            officeProduction += await getOfficeLimitedProduction(
              nsLocator,
              divisionName,
              officeCityName,
              productInfo.size
            );
          }
        }
      }

      officeProductionMap.set(officeKey, officeProduction);
      logWriter.writeLine(
        `  ${divisionName} - ${officeCityName} : ${officeProduction}`
      );
    }
  }
}

async function monitorWarehouseCongestion(
  nsPackage: NetscriptPackage,
  logWriter: Logger
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  await waitForState(netscript, 'PRODUCTION');

  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine('Monitoring Warehouse Congestion');
  const corpApi = nsLocator.corporation;
  const corporationInfo = await corpApi['getCorporation']();
  for (const divisionName of corporationInfo.divisions) {
    const divisionInfo = await corpApi['getDivision'](divisionName);
    const industryInfo = await corpApi['getIndustryData'](divisionInfo.type);
    for (const officeCityName of divisionInfo.cities) {
      const officeInfo = await corpApi['getOffice'](
        divisionName,
        officeCityName
      );
      if (
        !(await corpApi['hasWarehouse'](divisionName, officeCityName)) ||
        officeInfo.numEmployees < 1
      ) {
        continue;
      }

      let allOutputsProduced = true;
      for (const materialName of industryInfo.producedMaterials ?? []) {
        const materialInfo = await corpApi['getMaterial'](
          divisionName,
          officeCityName,
          materialName
        );
        allOutputsProduced =
          allOutputsProduced && materialInfo.productionAmount > 0;
      }
      for (const productName of divisionInfo.products) {
        const productInfo = await corpApi['getProduct'](
          divisionName,
          officeCityName,
          productName
        );
        allOutputsProduced =
          allOutputsProduced &&
          (productInfo.productionAmount > 0 ||
            productInfo.developmentProgress < 100);
      }

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

async function manageWarehouse(nsPackage: NetscriptPackage, logWriter: Logger) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  await waitForState(netscript, 'START');

  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine('Managing Warehouse Storage');
  const corpApi = nsLocator.corporation;
  const corporationInfo = await corpApi['getCorporation']();
  for (const divisionName of corporationInfo.divisions) {
    const divisionInfo = await corpApi['getDivision'](divisionName);
    const industryInfo = await corpApi['getIndustryData'](divisionInfo.type);
    for (const officeCityName of divisionInfo.cities) {
      const officeInfo = await corpApi['getOffice'](
        divisionName,
        officeCityName
      );
      if (
        !(await corpApi['hasWarehouse'](divisionName, officeCityName)) ||
        officeInfo.numEmployees < 1
      ) {
        continue;
      }

      const officeKey = getOfficeKey(divisionName, officeCityName);
      if (isWarehouseCongested(officeKey)) {
        logWriter.writeLine(
          `  ${divisionName} - ${officeCityName} : Congested`
        );
        for (const materialName of Object.keys(
          industryInfo.requiredMaterials
        )) {
          const materialInfo = await corpApi['getMaterial'](
            divisionName,
            officeCityName,
            materialName
          );
          const sellAmount = materialInfo.stored / 10;
          await corpApi['sellMaterial'](
            divisionName,
            officeCityName,
            materialName,
            `${sellAmount}`,
            '0'
          );
          await corpApi['buyMaterial'](
            divisionName,
            officeCityName,
            materialName,
            0
          );
          warehouseCongestionMap.set(officeKey, 0);
          logWriter.writeLine(`    ${materialName} - ${sellAmount}`);
        }
      } else {
        logWriter.writeLine(
          `  ${divisionName} - ${officeCityName} : Purchases`
        );
        const warehouseInfo = await corpApi['getWarehouse'](
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
          const materialData = await corpApi['getMaterialData'](
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
          const materialInfo = await corpApi['getMaterial'](
            divisionName,
            officeCityName,
            materialName
          );
          const buyAmount = Math.max(
            0,
            fewestOuputUnits * requiredCoefficient - materialInfo.stored
          );
          inputMaterialAmounts.set(materialName, buyAmount);

          const materialData = await corpApi['getMaterialData'](
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
          await corpApi['buyMaterial'](
            divisionName,
            officeCityName,
            materialName,
            buyAmount / 10
          );
          await corpApi['sellMaterial'](
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
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  netscript.atExit(async () => {
    handleShutdown(nsLocator);
    await sendMessage(new ExitEvent(), SUBSCRIBER_NAME);
  });
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Corporation Custom Smart Supply');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going supply details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const taskPromises = [];

  officeProductionMap = new Map<string, number>();
  taskPromises.push(
    infiniteLoop(
      netscript,
      monitorOfficeProduction,
      undefined,
      nsPackage,
      scriptLogWriter
    )
  );

  warehouseCongestionMap = new Map<string, number>();
  taskPromises.push(
    infiniteLoop(
      netscript,
      monitorWarehouseCongestion,
      undefined,
      nsPackage,
      scriptLogWriter
    )
  );

  taskPromises.push(
    infiniteLoop(
      netscript,
      manageWarehouse,
      undefined,
      nsPackage,
      scriptLogWriter
    )
  );

  await Promise.all(taskPromises);
}
