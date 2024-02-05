import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {openTail} from '/scripts/workflows/ui';
import {SCRIPTS_DIR} from '/scripts/common/shared';

import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {
  SHARE_RAM_WORKER_SCRIPT,
  runWorkerScript,
  waitForWorkers,
} from '/scripts/workflows/orchestration';
import {infiniteLoop, initializeScript} from '/scripts/workflows/execution';

import {FactionReputationFarmConfig} from '/scripts/workflows/farms';
import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {FarmFactionRepConfigEvent} from '/scripts/comms/events/farm-factionRep-config-event';
import {FarmFactionRepConfigRequest} from '/scripts/comms/requests/farm-factionRep-config-request';
import {FarmFactionRepConfigResponse} from '/scripts/comms/responses/farm-factionRep-config-response';
import {ExitEvent} from '/scripts/comms/events/exit-event';

export const FARM_FACTION_REPUTATION_SCRIPT = `${SCRIPTS_DIR}/farm-factionRep.js`;
export const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_INCLUDE_HOME, false]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'farm-factionExp';
const SUBSCRIBER_NAME = 'farm-factionExp';

const TAIL_X_POS = 1015;
const TAIL_Y_POS = 105;
const TAIL_WIDTH = 650;
const TAIL_HEIGHT = 500;

let scriptConfig: FactionReputationFarmConfig;
let workerPids: number[] | undefined;

async function shareRam(netscript: NS, logWriter: Logger) {
  logWriter.writeLine('Sharing RAM to boost faction reputation gains...');
  workerPids = runWorkerScript(
    netscript,
    SHARE_RAM_WORKER_SCRIPT,
    WORKERS_PACKAGE,
    true,
    1,
    scriptConfig.includeHome
  );

  logWriter.writeLine('Waiting for all RAM sharing to complete...');
  await waitForWorkers(netscript, workerPids);
  workerPids = undefined;
  logWriter.writeLine('Faction reputation farm cycle complete!');
  logWriter.writeLine(SECTION_DIVIDER);
}

function handleUpdateConfigEvent(
  eventData: FarmFactionRepConfigEvent,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  const newConfig = eventData.config;
  scriptConfig.includeHome = newConfig.includeHome ?? scriptConfig.includeHome;

  logWriter.writeLine(`  Include Home : ${scriptConfig.includeHome}`);
}

function handleConfigRequest(
  requestData: FarmFactionRepConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending farm faction reputation manager config response to ${requestData.sender}`
  );
  sendMessage(
    new FarmFactionRepConfigResponse(scriptConfig),
    requestData.sender
  );
}

function handleExit(eventData: ExitEvent, netscript: NS) {
  if (workerPids) {
    for (const pid of workerPids) {
      netscript.kill(pid);
    }
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Boost Faction Reputation Gain Farm');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;

  terminalWriter.writeLine(`Include Home : ${includeHome}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  scriptConfig = {
    includeHome: includeHome,
  };

  terminalWriter.writeLine('See script logs for on-going farming details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(ExitEvent, handleExit, netscript);
  eventListener.addListener(
    FarmFactionRepConfigEvent,
    handleUpdateConfigEvent,
    scriptLogWriter
  );
  eventListener.addListener(
    FarmFactionRepConfigRequest,
    handleConfigRequest,
    scriptLogWriter
  );

  await infiniteLoop(
    netscript,
    shareRam,
    undefined,
    netscript,
    scriptLogWriter
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
