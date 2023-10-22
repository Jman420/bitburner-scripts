import {NS} from '@ns';

import {getLogger, Logger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';
import {LOGGING_PACKAGE} from '/scripts/logging/package';

import {maxScriptThreads, scanLocalNetwork} from '/scripts/workflows/recon';
import {obtainRoot} from '/scripts/workflows/escalation';
import {
  copyFiles,
  runScript,
  spawnScript,
} from '/scripts/workflows/propagation';
import {getCmdArgFlag, randomIntWithinRange} from '/scripts/workflows/shared';
import {WORKFLOWS_PACKAGE} from '/scripts/workflows/package';

import {
  CMD_ARG_DELAY,
  CMD_ARG_SCRIPT_PATH,
  CMD_ARG_THREAD_COUNT,
} from '/scripts/delay-script-runner';

const WORM_SCRIPT = '/scripts/gwh-worm.js';
const ATTACK_SCRIPT = '/scripts/gwh-attack.js';
const RUNNER_SCRIPT = '/scripts/delay-script-runner.js';
const RUNNER_SCRIPT_MIN_DELAY = 1;
const RUNNER_SCRIPT_MAX_DELAY = 100;

const PAYLOAD_PACKAGE = [WORM_SCRIPT, RUNNER_SCRIPT, ATTACK_SCRIPT];

async function attackNetwork(netscript: NS, logWriter: Logger) {
  const hosts = scanLocalNetwork(netscript);
  logWriter.writeLine(`Found ${hosts.length} available servers`);

  for (const hostname of hosts) {
    logWriter.writeLine(ENTRY_DIVIDER);
    logWriter.writeLine(`Analyzing server : ${hostname}`);
    let rootAccess = netscript.hasRootAccess(hostname);
    if (!rootAccess) {
      logWriter.writeLine('  Obtaining Root...');
      rootAccess = obtainRoot(netscript, hostname);
    }

    if (rootAccess) {
      if (
        !netscript.isRunning(WORM_SCRIPT, hostname) &&
        !netscript.isRunning(ATTACK_SCRIPT, hostname)
      ) {
        logWriter.writeLine('  Copying Workflow Scripts...');
        await copyFiles(netscript, WORKFLOWS_PACKAGE, hostname);
        logWriter.writeLine('  Copying Logging Scripts...');
        await copyFiles(netscript, LOGGING_PACKAGE, hostname);
        logWriter.writeLine('  Copying Payload Scripts...');
        await copyFiles(netscript, PAYLOAD_PACKAGE, hostname);
        logWriter.writeLine('  Running Worm Script...');
        if (!runScript(netscript, WORM_SCRIPT, hostname, false)) {
          logWriter.writeLine('  Worm Execution Failed!');
        }
      }
    }
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'gwh-worm');
  const hostname = netscript.getHostname();
  logWriter.writeLine('Local Grow-Weaken-Hack Attack Worm');
  logWriter.writeLine(`Local Host : ${hostname}`);
  logWriter.writeLine(SECTION_DIVIDER);
  await attackNetwork(netscript, logWriter);

  const runnerDelay = randomIntWithinRange(
    RUNNER_SCRIPT_MIN_DELAY,
    RUNNER_SCRIPT_MAX_DELAY
  );
  const attackDelay = randomIntWithinRange(
    RUNNER_SCRIPT_MIN_DELAY,
    RUNNER_SCRIPT_MAX_DELAY
  );
  const threadCount = maxScriptThreads(
    netscript,
    hostname,
    ATTACK_SCRIPT,
    true,
    RUNNER_SCRIPT
  );
  logWriter.writeLine('Spawning Runner Script...');
  if (
    !spawnScript(
      netscript,
      RUNNER_SCRIPT,
      runnerDelay,
      false,
      getCmdArgFlag(CMD_ARG_SCRIPT_PATH),
      ATTACK_SCRIPT,
      getCmdArgFlag(CMD_ARG_DELAY),
      attackDelay,
      getCmdArgFlag(CMD_ARG_THREAD_COUNT),
      threadCount
    )
  ) {
    logWriter.writeLine('Spawning Runner Script Failed!');
  }
}
