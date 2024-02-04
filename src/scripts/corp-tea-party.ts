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

import {openTail} from '/scripts/workflows/ui';

import {infiniteLoop, initializeScript} from '/scripts/workflows/execution';
import {waitForState} from '/scripts/workflows/corporation-actions';
import {TeaPartyConfig} from '/scripts/workflows/corporation-shared';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {TeaPartyConfigEvent} from '/scripts/comms/events/tea-party-config-event';
import {TeaPartyConfigRequest} from '/scripts/comms/requests/tea-party-config-request';
import {TeaPartyConfigResponse} from '/scripts/comms/responses/tea-party-config-response';
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

const DEFAULT_MORALE_LIMIT = 95;
const DEFAULT_ENERGY_LIMIT = 98;
const DEFAULT_PARTY_FUNDS = 500000;

const CMD_FLAG_MORALE_LIMIT = 'moraleLimit';
const CMD_FLAG_ENERGY_LIMIT = 'energyLimit';
const CMD_FLAG_PARTY_FUNDS = 'partyFunds';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_MORALE_LIMIT, DEFAULT_MORALE_LIMIT],
  [CMD_FLAG_ENERGY_LIMIT, DEFAULT_ENERGY_LIMIT],
  [CMD_FLAG_PARTY_FUNDS, DEFAULT_PARTY_FUNDS],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);
const ENERGY_MORALE_LIMIT_AUTOCOMPLETE = [25, 50, 75, 80, 90];

const MODULE_NAME = 'corp-tea-party';
const SUBSCRIBER_NAME = 'corp-tea-party';

const TAIL_X_POS = 320;
const TAIL_Y_POS = 1035;
const TAIL_WIDTH = 855;
const TAIL_HEIGHT = 310;

let scriptConfig: TeaPartyConfig;

async function manageTeaParty(nsPackage: NetscriptPackage, logWriter: Logger) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const corpApi = nsLocator.corporation;
  const corpInfo = await corpApi['getCorporation']();
  for (const divisionName of corpInfo.divisions) {
    const divisionInfo = await corpApi['getDivision'](divisionName);
    for (const cityName of divisionInfo.cities) {
      const officeInfo = await corpApi['getOffice'](divisionName, cityName);
      const officeHasEmployees = officeInfo.numEmployees > 0;
      if (
        officeHasEmployees &&
        officeInfo.avgEnergy <= scriptConfig.energyLimit
      ) {
        const teaPurchased = await corpApi['buyTea'](divisionName, cityName);
        logWriter.writeLine(
          `Tea purchased for ${divisionName} office in ${cityName} : ${teaPurchased}`
        );
      }
      if (
        officeHasEmployees &&
        officeInfo.avgMorale <= scriptConfig.moraleLimit
      ) {
        await corpApi['throwParty'](
          divisionName,
          cityName,
          scriptConfig.partyFunds
        );
        const partyCost = scriptConfig.partyFunds * officeInfo.numEmployees;
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

function handleUpdateConfigEvent(
  eventData: TeaPartyConfigEvent,
  netscript: NS,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  scriptConfig = eventData.config;
  if (scriptConfig.moraleLimit < 0) {
    scriptConfig.moraleLimit = DEFAULT_MORALE_LIMIT;
  }
  if (scriptConfig.energyLimit < 0) {
    scriptConfig.energyLimit = DEFAULT_ENERGY_LIMIT;
  }
  if (scriptConfig.partyFunds < 0) {
    scriptConfig.partyFunds = DEFAULT_PARTY_FUNDS;
  }

  logWriter.writeLine(`  Morale Limit : ${scriptConfig.moraleLimit}`);
  logWriter.writeLine(`  Energy Limit : ${scriptConfig.energyLimit}`);
  logWriter.writeLine(
    `  Party Funds : ${netscript.formatNumber(scriptConfig.partyFunds)}`
  );
}

function handleTeaPartyConfigRequest(
  requestData: TeaPartyConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending tea party config response to ${requestData.sender}`
  );
  sendMessage(new TeaPartyConfigResponse(scriptConfig), requestData.sender);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Corporate Tea Party Automation');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const moraleLimit = cmdArgs[CMD_FLAG_MORALE_LIMIT].valueOf() as number;
  const energyLimit = cmdArgs[CMD_FLAG_ENERGY_LIMIT].valueOf() as number;
  const partyFunds = cmdArgs[CMD_FLAG_PARTY_FUNDS].valueOf() as number;

  terminalWriter.writeLine(`Morale Limit : ${moraleLimit}`);
  terminalWriter.writeLine(`Energy Limit : ${energyLimit}`);
  terminalWriter.writeLine(
    `Party Funds : ${netscript.formatNumber(partyFunds)}`
  );
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going party details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(
    TeaPartyConfigEvent,
    handleUpdateConfigEvent,
    netscript,
    scriptLogWriter
  );
  eventListener.addListener(
    TeaPartyConfigRequest,
    handleTeaPartyConfigRequest,
    scriptLogWriter
  );

  scriptLogWriter.writeLine('Corporate Tea Party Automation');
  scriptLogWriter.writeLine(SECTION_DIVIDER);
  scriptLogWriter.writeLine(`Morale Limit : ${moraleLimit}`);
  scriptLogWriter.writeLine(`Energy Limit : ${energyLimit}`);
  scriptLogWriter.writeLine(
    `Party Funds : ${netscript.formatNumber(partyFunds)}`
  );
  scriptLogWriter.writeLine(SECTION_DIVIDER);

  scriptConfig = {
    energyLimit: energyLimit,
    moraleLimit: moraleLimit,
    partyFunds: partyFunds,
  };

  await infiniteLoop(
    netscript,
    manageTeaParty,
    undefined,
    nsPackage,
    scriptLogWriter
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
