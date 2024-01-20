import {AutocompleteData, NS} from '@ns';

import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

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
import {SCRIPTS_PATH} from '/scripts/common/shared';

import {
  analyzeHost,
  filterHostsCanHack,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {WEAKEN_WORKER_SCRIPT} from '/scripts/workflows/orchestration';
import {
  infiniteLoop,
  initializeScript,
  runScript,
  waitForScripts,
} from '/scripts/workflows/execution';
import {
  ServerDetailsExtended,
  getHackingExpGain,
  scoreHostForExperience,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';
import {openTail} from '/scripts/workflows/ui';

export const FARM_HACK_EXP_SCRIPT = `${SCRIPTS_PATH}/farm-hackExp.js`;
export const CMD_FLAG_INCLUDE_HOME = 'includeHome';
export const CMD_FLAG_OPTIMAL_ONLY = 'optimalOnly';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_OPTIMAL_ONLY, 0],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'farm-hackExp';
const SUBSCRIBER_NAME = 'farm-hackExp';

const TAIL_X_POS = 1045;
const TAIL_Y_POS = 154;
const TAIL_WIDTH = 1275;
const TAIL_HEIGHT = 510;

async function attackTargets(
  nsPackage: NetscriptPackage,
  includeHomeAttacker: boolean,
  optimalOnlyCount: number,
  logWriter: Logger
) {
  const netscript = nsPackage.netscript;

  logWriter.writeLine('Identifying available targets...');
  let targetHosts = scanWideNetwork(netscript, false, true, false, false);
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

  if (optimalOnlyCount > 0) {
    logWriter.writeLine(
      `Isolating top ${optimalOnlyCount} most optimal targets...`
    );
    targetHosts = targetsAnalysis
      .slice(0, optimalOnlyCount)
      .map(hostDetails => hostDetails.hostname);
  }

  logWriter.writeLine('Getting all rooted hosts...');
  const rootedHosts = scanWideNetwork(
    netscript,
    includeHomeAttacker,
    true,
    true
  );
  logWriter.writeLine(`Found ${rootedHosts.length} rooted hosts.`);

  logWriter.writeLine(
    `Weakening ${targetHosts.length} hosts for hacking experience : ${targetHosts}`
  );
  const scriptArgs = [getCmdFlag(CMD_FLAG_TARGETS_CSV), targetHosts.join(',')];
  const workerPids = [];
  for (const hostname of rootedHosts) {
    netscript.scp(WORKERS_PACKAGE, hostname);
    workerPids.push(
      runScript(netscript, WEAKEN_WORKER_SCRIPT, {
        hostname: hostname,
        useMaxThreads: true,
        args: scriptArgs,
      })
    );
  }

  logWriter.writeLine('Waiting for all attacks to complete...');
  await waitForScripts(netscript, workerPids);
  logWriter.writeLine('Hack experience farm cycle complete!');
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Hacking Experience Farm - Using Weaken');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;
  const optimalOnlyCount = cmdArgs[CMD_FLAG_OPTIMAL_ONLY].valueOf() as number;

  terminalWriter.writeLine(`Include Home : ${includeHome}`);
  terminalWriter.writeLine(`Optimal Only : ${optimalOnlyCount}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going farming details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  await infiniteLoop(
    netscript,
    attackTargets,
    nsPackage,
    includeHome,
    optimalOnlyCount,
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
