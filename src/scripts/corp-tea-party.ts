import {AutocompleteData, NS} from '@ns';

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
import {waitForState} from '/scripts/workflows/corporation';
import {openTail} from '/scripts/workflows/ui';

const CMD_FLAG_MORALE_LIMIT = 'moraleLimit';
const CMD_FLAG_ENERGY_LIMIT = 'energyLimit';
const CMD_FLAG_PARTY_FUNDS = 'partyFunds';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_MORALE_LIMIT, 95],
  [CMD_FLAG_ENERGY_LIMIT, 98],
  [CMD_FLAG_PARTY_FUNDS, 500000],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);
const ENERGY_MORALE_LIMIT_AUTOCOMPLETE = [25, 50, 75, 80, 90];

const MODULE_NAME = 'corp-tea-party';
const SUBSCRIBER_NAME = 'corp-tea-party';

const TAIL_X_POS = 1230;
const TAIL_Y_POS = 120;
const TAIL_WIDTH = 1090;
const TAIL_HEIGHT = 490;

const UPDATE_DELAY = 0;

async function manageTeaParty(
  netscript: NS,
  logWriter: Logger,
  energyLimit: number,
  moraleLimit: number,
  partyFunds: number
) {
  const corpInfo = netscript.corporation.getCorporation();
  for (const divisionName of corpInfo.divisions) {
    const divisionInfo = netscript.corporation.getDivision(divisionName);
    for (const cityName of divisionInfo.cities) {
      const officeInfo = netscript.corporation.getOffice(
        divisionName,
        cityName
      );
      if (officeInfo.avgEnergy <= energyLimit) {
        const teaPurchased = netscript.corporation.buyTea(
          divisionName,
          cityName
        );
        logWriter.writeLine(
          `Tea purchased for ${divisionName} office in ${cityName} : ${teaPurchased}`
        );
      }
      if (officeInfo.avgMorale <= moraleLimit) {
        netscript.corporation.throwParty(divisionName, cityName, partyFunds);
        const partyCost = partyFunds * officeInfo.numEmployees;
        logWriter.writeLine(
          `Threw party for ${divisionName} office in ${cityName} : $${netscript.formatNumber(
            partyCost
          )}`
        );
      }
    }
  }

  await waitForState(netscript, 'START');
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Corporate Tea Party Automation');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const energyLimit = cmdArgs[CMD_FLAG_ENERGY_LIMIT].valueOf() as number;
  const moraleLimit = cmdArgs[CMD_FLAG_MORALE_LIMIT].valueOf() as number;
  const partyFunds = cmdArgs[CMD_FLAG_PARTY_FUNDS].valueOf() as number;

  terminalWriter.writeLine(`Morale Limit : ${moraleLimit}`);
  terminalWriter.writeLine(`Energy Limit : ${energyLimit}`);
  terminalWriter.writeLine(`Party Funds : ${partyFunds}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going party details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  scriptLogWriter.writeLine('Corporate Tea Party Automation');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  scriptLogWriter.writeLine(`Morale Limit : ${moraleLimit}`);
  scriptLogWriter.writeLine(`Energy Limit : ${energyLimit}`);
  scriptLogWriter.writeLine(`Party Funds : ${partyFunds}`);
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    manageTeaParty,
    netscript,
    scriptLogWriter,
    energyLimit,
    moraleLimit,
    partyFunds
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_ENERGY_LIMIT)) {
    return ENERGY_MORALE_LIMIT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MORALE_LIMIT)) {
    return ENERGY_MORALE_LIMIT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
