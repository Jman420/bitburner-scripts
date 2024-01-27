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

import {scanWideNetwork} from '/scripts/workflows/recon';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {SHARE_RAM_WORKER_SCRIPT} from '/scripts/workflows/orchestration';
import {
  infiniteLoop,
  initializeScript,
  runScript,
  waitForScripts,
} from '/scripts/workflows/execution';

import {FactionReputationFarmConfig} from '/scripts/workflows/farms';
import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {FarmFactionRepConfigEvent} from '/scripts/comms/events/farm-factionRep-config-event';
import {FarmFactionRepConfigRequest} from '/scripts/comms/requests/farm-factionRep-config-request';
import {FarmFactionRepConfigResponse} from '/scripts/comms/responses/farm-factionRep-config-response';

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

let managerConfig: FactionReputationFarmConfig;

async function shareRam(netscript: NS, logWriter: Logger) {
  logWriter.writeLine('Identifying available targets...');
  const targetHosts = scanWideNetwork(
    netscript,
    managerConfig.includeHome,
    true,
    true
  );
  logWriter.writeLine(`Found ${targetHosts.length} target hosts.`);

  logWriter.writeLine('Sharing RAM to boost faction reputation gains...');
  const workerPids = [];
  for (const hostname of targetHosts) {
    netscript.scp(WORKERS_PACKAGE, hostname);
    workerPids.push(
      runScript(netscript, SHARE_RAM_WORKER_SCRIPT, {
        hostname: hostname,
        useMaxThreads: true,
        tempScript: true,
      })
    );
  }

  logWriter.writeLine('Waiting for all RAM sharing to complete...');
  await waitForScripts(netscript, workerPids);
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
  managerConfig.includeHome =
    newConfig.includeHome ?? managerConfig.includeHome;

  logWriter.writeLine(`  Include Home : ${managerConfig.includeHome}`);
}

function handleConfigRequest(
  requestData: FarmFactionRepConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending farm faction reputation manager config response to ${requestData.sender}`
  );
  sendMessage(
    new FarmFactionRepConfigResponse(managerConfig),
    requestData.sender
  );
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Boost Faction Reputation Gain Farm');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;

  terminalWriter.writeLine(`Include Home : ${includeHome}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  managerConfig = {
    includeHome: includeHome,
  };

  terminalWriter.writeLine('See script logs for on-going farming details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  const eventListener = new EventListener(SUBSCRIBER_NAME);
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

  await infiniteLoop(netscript, shareRam, netscript, scriptLogWriter);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
