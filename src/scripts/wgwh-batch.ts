import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  ENTRY_DIVIDER,
  SECTION_DIVIDER,
  convertMillisecToTime,
} from '/scripts/logging/logOutput';

import {
  BOOLEAN_AUTOCOMPLETE,
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {
  getRequiredRam,
  infiniteLoop,
  runWorkerScript,
} from '/scripts/workflows/execution';
import {
  analyzeHost,
  getTotalAvailableRam,
  getTotalMaxRam,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {
  WeightScoreValues,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';
import {
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  WEAKEN_WORKER_SCRIPT,
  hackThreadsRequired,
  weakenThreadsRequired,
} from '/scripts/workflows/orchestration';
import {CMD_FLAG_DELAY, CMD_FLAG_TARGETS_CSV} from '/scripts/workers/shared';
import {WORKERS_PACKAGE} from '/scripts/workers/package';

const MODULE_NAME = 'wgwh-batches';
const DEFAULT_SLEEP_FOR_RAM = 500;
const BATCH_BUFFER_DELAY = 100;

const CMD_FLAG_CONTINUOUS_ATTACK = 'continuousAttack';
const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAG_OPTIMAL_ONLY = 'optimalOnly';
const CMD_FLAG_HACK_PERCENT = 'hackPercent';
const CMD_FLAG_FUNDS_LIMIT_WEIGHT = 'fundsLimitWeight';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_CONTINUOUS_ATTACK, false],
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_OPTIMAL_ONLY, 0],
  [CMD_FLAG_HACK_PERCENT, 0.75],
  [CMD_FLAG_FUNDS_LIMIT_WEIGHT, 1],
  [CMD_FLAG_TARGETS, ''],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

async function attackTargets(
  netscript: NS,
  logWriter: Logger,
  targetHosts: string[],
  hackPercent = 0.75,
  optimalOnlyCount = 0,
  includeHomeAttacker = false,
  fundsLimitWeight = 1,
  weightScoreValues: WeightScoreValues = {
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
    expGain: 1,
  },
  totalRamBuffer = 2
) {
  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all rooted host targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true, false, true);
  }
  logWriter.writeLine('Sorting target hosts by optimality...');
  let targetsAnalysis = targetHosts.map(value => analyzeHost(netscript, value));
  sortOptimalTargetHosts(targetsAnalysis, weightScoreValues);
  logWriter.writeLine(`Sorted ${targetsAnalysis.length} target hosts.`);

  if (optimalOnlyCount > 0) {
    logWriter.writeLine(
      `Isolating top ${optimalOnlyCount} most optimal targets...`
    );
    targetsAnalysis = targetsAnalysis.slice(0, optimalOnlyCount);
  }

  logWriter.writeLine(`Attacking ${targetsAnalysis.length} targets...`);
  for (
    let targetCounter = 0;
    targetCounter < targetsAnalysis.length;
    targetCounter++
  ) {
    const targetDetails = targetsAnalysis[targetCounter];
    const hostname = targetDetails.hostname;

    logWriter.writeLine(ENTRY_DIVIDER);
    logWriter.writeLine(`Target Host : ${hostname}`);

    // Determine Total Ram needed to fully attack the server (add a constant buffer amount to be safe)
    logWriter.writeLine('  Calculating required RAM for batches...');
    const weakenGrowBatchThreads = weakenThreadsRequired(
      netscript,
      targetDetails.securityLevel - targetDetails.minSecurityLevel
    );
    const weakenGrowBatchRam = getRequiredRam(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      weakenGrowBatchThreads
    );

    const growBatchThreads = netscript.formulas.hacking.growThreads(
      netscript.getServer(hostname),
      netscript.getPlayer(),
      fundsLimitWeight * targetDetails.maxFunds
    );
    const growBatchRam = getRequiredRam(
      netscript,
      GROW_WORKER_SCRIPT,
      growBatchThreads
    );
    const growBatchSecurityIncrease = netscript.growthAnalyzeSecurity(
      growBatchThreads,
      hostname
    );

    const weakenHackBatchThreads = weakenThreadsRequired(
      netscript,
      growBatchSecurityIncrease
    );
    const weakenHackBatchRam = getRequiredRam(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      weakenHackBatchThreads
    );

    const hackBatchThreads = hackThreadsRequired(
      netscript,
      hostname,
      hackPercent * targetDetails.availableFunds
    );
    const hackBatchRam = getRequiredRam(
      netscript,
      HACK_WORKER_SCRIPT,
      hackBatchThreads
    );
    const totalRamRequired =
      weakenGrowBatchRam +
      growBatchRam +
      weakenHackBatchRam +
      hackBatchRam +
      totalRamBuffer;

    // Determine if Total Ram can be satisfied by accessible servers (max ram) ; if not then skip
    const attackHosts = scanWideNetwork(
      netscript,
      includeHomeAttacker,
      true,
      true,
      false
    );
    const totalAttackMaxRam = getTotalMaxRam(netscript, attackHosts);
    if (totalAttackMaxRam < totalRamRequired) {
      logWriter.writeLine(
        '  Required RAM not satisfied by accessible servers.  Skipping target!'
      );
      continue;
    }

    // Determine if Total Ram can be satisifed with available ram on servers ; if not then wait until Total Ram is available
    if (getTotalAvailableRam(netscript, attackHosts) < totalRamRequired) {
      logWriter.writeLine('  Waiting for required RAM to become available...');
      while (getTotalAvailableRam(netscript, attackHosts) < totalRamRequired) {
        await netscript.sleep(DEFAULT_SLEEP_FOR_RAM);
      }
    }

    // Calculate necessary delays for weaken, grow, weaken & hack batches
    logWriter.writeLine('  Calculating delays for worker scripts...');
    const weakenGrowBatchDelay = 0;
    const growBatchDelay =
      targetDetails.weakenTime -
      targetDetails.growTime +
      weakenGrowBatchDelay +
      BATCH_BUFFER_DELAY;
    const weakenHackBatchDelay = BATCH_BUFFER_DELAY * 2;
    const hackBatchDelay =
      targetDetails.weakenTime -
      targetDetails.hackTime +
      weakenHackBatchDelay +
      BATCH_BUFFER_DELAY;

    // Execute scripts with appropriate delays
    logWriter.writeLine('  Executing worker scripts...');
    runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      weakenGrowBatchThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      weakenGrowBatchDelay
    );
    runWorkerScript(
      netscript,
      GROW_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      growBatchThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      growBatchDelay
    );
    runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      weakenHackBatchThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      weakenHackBatchDelay
    );
    runWorkerScript(
      netscript,
      HACK_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      hackBatchThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      hackBatchDelay
    );
    logWriter.writeLine(
      `  Estimated batch completion ~${convertMillisecToTime(
        hackBatchDelay + targetDetails.hackTime
      )}`
    );
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Weaken-Grow Weaken-Hack Attack Batcher');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const continuousAttack = cmdArgs[
    CMD_FLAG_CONTINUOUS_ATTACK
  ].valueOf() as boolean;
  const includeHomeAttacker = cmdArgs[
    CMD_FLAG_INCLUDE_HOME
  ].valueOf() as boolean;
  const optimalOnlyCount = cmdArgs[CMD_FLAG_OPTIMAL_ONLY].valueOf() as number;
  const hackPercent = cmdArgs[CMD_FLAG_HACK_PERCENT].valueOf() as number;
  const fundsLimitWeight = cmdArgs[
    CMD_FLAG_FUNDS_LIMIT_WEIGHT
  ].valueOf() as number;
  const targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  terminalWriter.writeLine(`Continuous Attack : ${continuousAttack}`);
  terminalWriter.writeLine(`Include Home Attacker : ${includeHomeAttacker}`);
  terminalWriter.writeLine(`Optimal Only : ${optimalOnlyCount}`);
  terminalWriter.writeLine(`Hack Percent : ${hackPercent}`);
  terminalWriter.writeLine(`Funds Limit Weight : ${fundsLimitWeight}`);
  terminalWriter.writeLine(`Target Hosts : ${targetHosts}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('See script logs for on-going attack details.');
  netscript.tail();

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  if (continuousAttack) {
    await infiniteLoop(
      netscript,
      attackTargets,
      netscript,
      scriptLogWriter,
      targetHosts,
      hackPercent,
      optimalOnlyCount,
      includeHomeAttacker,
      fundsLimitWeight
    );
  } else {
    await attackTargets(
      netscript,
      scriptLogWriter,
      targetHosts,
      hackPercent,
      optimalOnlyCount,
      includeHomeAttacker,
      fundsLimitWeight
    );
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_CONTINUOUS_ATTACK)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_INCLUDE_HOME)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_OPTIMAL_ONLY)) {
    return ['1', '2', '3', '5', '10', '15'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_HACK_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_WEIGHT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
