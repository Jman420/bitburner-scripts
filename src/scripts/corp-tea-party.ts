import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';

const CMD_FLAG_ENERGY_LIMIT = 'energyLimit';
const CMD_FLAG_MORALE_LIMIT = 'moraleLimit';
const CMD_FLAG_PARTY_FUNDS = 'partyFunds';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_ENERGY_LIMIT, 0.8],
  [CMD_FLAG_MORALE_LIMIT, 0.8],
  [CMD_FLAG_PARTY_FUNDS, 500000],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'corp-tea-party';
const SUBSCRIBER_NAME = 'corp-tea-party';
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
      let threwTeaParty = false;
      if (officeInfo.avgEnergy <= energyLimit) {
        threwTeaParty = netscript.corporation.buyTea(divisionName, cityName);
        logWriter.writeLine(
          `Tea purchased for ${divisionName} office in ${cityName} : ${threwTeaParty}`
        );
      }
      if (officeInfo.avgMorale <= moraleLimit) {
        const partyCost = netscript.corporation.throwParty(
          divisionName,
          cityName,
          partyFunds
        );
        threwTeaParty = true;
        logWriter.writeLine(
          `Threw party for ${divisionName} office in ${cityName} : $${netscript.formatNumber(
            partyCost
          )}`
        );
      }
      if (threwTeaParty) {
        logWriter.writeLine(ENTRY_DIVIDER);
      }
    }
  }

  await netscript.corporation.nextUpdate();
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

  terminalWriter.writeLine(`Energy Limit : ${energyLimit}`);
  terminalWriter.writeLine(`Morale Limit : ${moraleLimit}`);
  terminalWriter.writeLine(`Party Funds : ${partyFunds}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  delayedInfiniteLoop(
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
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_MORALE_LIMIT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
