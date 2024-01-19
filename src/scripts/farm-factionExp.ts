import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {getAvailableRam, scanWideNetwork} from '/scripts/workflows/recon';
import {copyFiles} from '/scripts/workflows/propagation';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {SHARE_RAM_WORKER_SCRIPT} from '/scripts/workflows/orchestration';
import {initializeScript, runScript} from '/scripts/workflows/execution';

const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_TARGETS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'farm-factionExp';
const SUBSCRIBER_NAME = 'farm-factionExp';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Boost Faction Reputation Gain Rate ');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;
  let targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  logWriter.writeLine(`Include Home : ${includeHome}`);
  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all rooted host targets...'
    );
    targetHosts = scanWideNetwork(netscript, includeHome, true, true);
  }
  logWriter.writeLine('Sorting target hosts by available RAM...');
  targetHosts.sort(
    (hostA, hostB) =>
      getAvailableRam(netscript, hostA) - getAvailableRam(netscript, hostB)
  );

  logWriter.writeLine('Executing Share Ram Bots');
  for (const hostname of targetHosts) {
    logWriter.writeLine(`  ${hostname} :`);
    logWriter.writeLine('    Copying workers file packages...');
    copyFiles(netscript, WORKERS_PACKAGE, hostname);

    logWriter.writeLine(`    Running ${SHARE_RAM_WORKER_SCRIPT}...`);
    if (
      runScript(netscript, SHARE_RAM_WORKER_SCRIPT, {
        hostname: hostname,
        useMaxThreads: true,
      })
    ) {
      logWriter.writeLine(
        `    Successfully running ${SHARE_RAM_WORKER_SCRIPT}.`
      );
    } else {
      logWriter.writeLine(`    Failed to run ${SHARE_RAM_WORKER_SCRIPT}.`);
    }
    logWriter.writeLine(ENTRY_DIVIDER);
  }
  logWriter.writeLine('Successfully ran Share Ram script on all target hosts.');
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
