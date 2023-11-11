import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  BOOLEAN_AUTOCOMPLETE,
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {
  CMD_FLAG_CONTINUOUS_ATTACK,
  CMD_FLAG_TARGETS_CSV,
} from '/scripts/workers/shared';

import {analyzeHost, scanWideNetwork} from '/scripts/workflows/recon';
import {copyFiles} from '/scripts/workflows/propagation';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {WEAKEN_WORKER_SCRIPT} from '/scripts/workflows/orchestration';
import {runScript} from '/scripts/workflows/execution';
import {
  scoreHostForExperience,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';

const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAG_OPTIMAL_ONLY = 'optimalOnly';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_OPTIMAL_ONLY, 0],
  [CMD_FLAG_TARGETS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'farm-hackExp', LoggerMode.TERMINAL);
  logWriter.writeLine('Hacking Experience Farm - Using Weaken');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;
  const optimalOnlyCount = cmdArgs[CMD_FLAG_OPTIMAL_ONLY].valueOf() as number;
  let targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  logWriter.writeLine(`Include Home : ${includeHome}`);
  logWriter.writeLine(`Optimal Only : ${optimalOnlyCount}`);
  logWriter.writeLine(`Attack Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all rooted host targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true, false, true);
  }
  logWriter.writeLine('Sorting target hosts by optimality...');
  const targetsAnalysis = targetHosts.map(value =>
    analyzeHost(netscript, value)
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

  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine('Getting all rooted hosts...');
  const rootedHosts = scanWideNetwork(netscript, includeHome, true, true);
  logWriter.writeLine(`Found ${rootedHosts.length} rooted hosts.`);

  logWriter.writeLine('Executing Hacking Experience Farm Bots');
  for (const hostname of rootedHosts) {
    logWriter.writeLine(`  ${hostname} :`);
    logWriter.writeLine('    Copying workers file packages...');
    copyFiles(netscript, WORKERS_PACKAGE, hostname);

    logWriter.writeLine(`    Running ${WEAKEN_WORKER_SCRIPT}...`);
    if (
      runScript(
        netscript,
        WEAKEN_WORKER_SCRIPT,
        hostname,
        0,
        true,
        getCmdFlag(CMD_FLAG_TARGETS_CSV),
        targetHosts.join(','),
        getCmdFlag(CMD_FLAG_CONTINUOUS_ATTACK),
        true
      )
    ) {
      logWriter.writeLine(`    Successfully running ${WEAKEN_WORKER_SCRIPT}.`);
    } else {
      logWriter.writeLine(`    Failed to run ${WEAKEN_WORKER_SCRIPT}.`);
    }
    logWriter.writeLine(ENTRY_DIVIDER);
  }
  logWriter.writeLine(
    'Successfully ran Hacking Experience Farm script on all available rooted hosts.'
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_INCLUDE_HOME)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
