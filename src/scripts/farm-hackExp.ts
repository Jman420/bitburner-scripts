import {AutocompleteData, NS} from '@ns';

import {
  NetscriptPackage,
  getGhostPackage,
} from '/scripts/netscript-services/netscript-ghost';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {CMD_FLAG_TARGETS_CSV} from '/scripts/workers/shared';
import {SCRIPTS_DIR} from '/scripts/common/shared';
import {openTail} from '/scripts/workflows/ui';

import {
  analyzeHost,
  filterHostsCanHack,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {
  WEAKEN_WORKER_SCRIPT,
  runWorkerScript,
  waitForWorkers,
} from '/scripts/workflows/orchestration';
import {infiniteLoop, initializeScript} from '/scripts/workflows/execution';
import {
  ServerDetailsExtended,
  getHackingExpGain,
  scoreHostForExperience,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';

import {HackExperienceFarmConfig} from '/scripts/workflows/farms';
import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {FarmHackExpConfigEvent} from '/scripts/comms/events/farm-hackExp-config-event';
import {FarmHackExpConfigRequest} from '/scripts/comms/requests/farm-hackExp-config-request';
import {FarmHackExpConfigResponse} from '/scripts/comms/responses/farm-hackExp-config-response';
import {ExitEvent} from '/scripts/comms/events/exit-event';

export const FARM_HACK_EXP_SCRIPT = `${SCRIPTS_DIR}/farm-hackExp.js`;
export const CMD_FLAG_INCLUDE_HOME = 'includeHome';
export const CMD_FLAG_OPTIMAL_ONLY = 'optimalOnly';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_OPTIMAL_ONLY, 0],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'farm-hackExp';
const SUBSCRIBER_NAME = 'farm-hackExp';

const TAIL_X_POS = 1015;
const TAIL_Y_POS = 105;
const TAIL_WIDTH = 650;
const TAIL_HEIGHT = 500;

let scriptConfig: HackExperienceFarmConfig;
let workerPids: number[] | undefined;

async function attackTargets(nsPackage: NetscriptPackage, logWriter: Logger) {
  const netscript = nsPackage.netscript;

  logWriter.writeLine('Identifying available targets...');
  let targetHosts = scanWideNetwork(netscript, {rootOnly: true});
  targetHosts = filterHostsCanHack(netscript, targetHosts);

  logWriter.writeLine('Sorting target hosts by optimality...');
  const targetsAnalysis = await Promise.all(
    targetHosts
      .map(value => analyzeHost(netscript, value))
      .map(async value => {
        const extendedValue = value as ServerDetailsExtended;
        extendedValue.expGain = await getHackingExpGain(
          nsPackage,
          value.hostname
        );
        return extendedValue;
      })
  );
  sortOptimalTargetHosts(targetsAnalysis, undefined, scoreHostForExperience);
  logWriter.writeLine(`Sorted ${targetsAnalysis.length} target hosts.`);

  if (scriptConfig.optimalOnlyCount > 0) {
    logWriter.writeLine(
      `Isolating top ${scriptConfig.optimalOnlyCount} most optimal targets...`
    );
    targetHosts = targetsAnalysis
      .slice(0, scriptConfig.optimalOnlyCount)
      .map(hostDetails => hostDetails.hostname);
  }

  logWriter.writeLine('Getting all rooted hosts...');
  const rootedHosts = scanWideNetwork(netscript, {
    includeHome: scriptConfig.includeHomeAttacker,
    rootOnly: true,
    requireRam: true,
  });
  logWriter.writeLine(`Found ${rootedHosts.length} rooted hosts.`);

  logWriter.writeLine(
    `Weakening ${targetHosts.length} hosts for hacking experience : ${targetHosts}`
  );
  const scriptArgs = [getCmdFlag(CMD_FLAG_TARGETS_CSV), targetHosts.join(',')];
  workerPids = runWorkerScript(
    netscript,
    WEAKEN_WORKER_SCRIPT,
    WORKERS_PACKAGE,
    true,
    1,
    scriptConfig.includeHomeAttacker,
    ...scriptArgs
  );

  logWriter.writeLine('Waiting for all attacks to complete...');
  await waitForWorkers(netscript, workerPids);
  workerPids = undefined;
  logWriter.writeLine('Hack experience farm cycle complete!');
  logWriter.writeLine(SECTION_DIVIDER);
}

function handleUpdateConfigEvent(
  eventData: FarmHackExpConfigEvent,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  const newConfig = eventData.config;
  scriptConfig.includeHomeAttacker =
    newConfig.includeHomeAttacker ?? scriptConfig.includeHomeAttacker;
  scriptConfig.optimalOnlyCount =
    newConfig.optimalOnlyCount ?? scriptConfig.optimalOnlyCount;

  logWriter.writeLine(`  Include Home : ${scriptConfig.includeHomeAttacker}`);
  logWriter.writeLine(`  Optimal Only : ${scriptConfig.optimalOnlyCount}`);
}

function handleConfigRequest(
  requestData: FarmHackExpConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending farm hack experience manager config response to ${requestData.sender}`
  );
  sendMessage(new FarmHackExpConfigResponse(scriptConfig), requestData.sender);
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
  const nsPackage = getGhostPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Hacking Experience Farm - Using Weaken');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHomeAttacker = cmdArgs[
    CMD_FLAG_INCLUDE_HOME
  ].valueOf() as boolean;
  const optimalOnlyCount = cmdArgs[CMD_FLAG_OPTIMAL_ONLY].valueOf() as number;

  terminalWriter.writeLine(`Include Home : ${includeHomeAttacker}`);
  terminalWriter.writeLine(`Optimal Only : ${optimalOnlyCount}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  scriptConfig = {
    includeHomeAttacker: includeHomeAttacker,
    optimalOnlyCount: optimalOnlyCount,
  };

  terminalWriter.writeLine('See script logs for on-going farming details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(ExitEvent, handleExit, netscript);
  eventListener.addListener(
    FarmHackExpConfigEvent,
    handleUpdateConfigEvent,
    scriptLogWriter
  );
  eventListener.addListener(
    FarmHackExpConfigRequest,
    handleConfigRequest,
    scriptLogWriter
  );

  await infiniteLoop(
    netscript,
    attackTargets,
    undefined,
    nsPackage,
    scriptLogWriter
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_OPTIMAL_ONLY)) {
    return [1, 2, 3, 5, 10];
  }

  return CMD_FLAGS;
}
