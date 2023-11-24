import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  ENTRY_DIVIDER,
  SECTION_DIVIDER,
  convertMillisecToTime,
} from '/scripts/logging/logOutput';

import {
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
  initializeScript,
  runWorkerScript,
  waitForScripts,
} from '/scripts/workflows/execution';
import {
  analyzeHost,
  filterHostsCanHack,
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
  weakenThreadsRequired,
} from '/scripts/workflows/orchestration';
import {CMD_FLAG_DELAY, CMD_FLAG_TARGETS_CSV} from '/scripts/workers/shared';
import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {openTail} from '/scripts/workflows/ui';

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
  [CMD_FLAG_TARGETS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'wgwh-batches';
const SUBSCRIBER_NAME = 'wgwh-batches';

const TAIL_X_POS = 1045;
const TAIL_Y_POS = 154;
const TAIL_WIDTH = 1275;
const TAIL_HEIGHT = 510;

const DEFAULT_SLEEP_FOR_RAM = 500;
const BATCH_BUFFER_DELAY = 100;

async function attackTargets(
  netscript: NS,
  logWriter: Logger,
  targetHosts: string[],
  targetFundsPercent = 0.75,
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
  }
) {
  if (targetHosts.length < 1) {
    logWriter.writeLine(
      'No target hosts provided.  Getting all rooted host targets...'
    );
    targetHosts = scanWideNetwork(netscript, false, true, false, true);
    targetHosts = filterHostsCanHack(netscript, targetHosts);
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
  logWriter.writeLine(SECTION_DIVIDER);
  let longestBatchTime = 0;
  const workerPids = new Array<number>();
  for (
    let targetCounter = 0;
    targetCounter < targetsAnalysis.length;
    targetCounter++
  ) {
    const targetDetails = targetsAnalysis[targetCounter];
    const hostname = targetDetails.hostname;
    logWriter.writeLine(`Target Host : ${hostname}`);
    const targetServer = netscript.getServer(hostname);
    const player = netscript.getPlayer();

    // Determine Total Ram needed to fully attack the server (add a constant buffer amount to be safe)
    logWriter.writeLine('  Calculating required threads & RAM for batches...');
    const weakenGrowBatchThreads = weakenThreadsRequired(
      targetDetails.securityLevel - targetDetails.minSecurityLevel
    );
    const weakenGrowBatchRam = getRequiredRam(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      weakenGrowBatchThreads
    );
    logWriter.writeLine(`    Weaken-Grow threads : ${weakenGrowBatchThreads}`);
    logWriter.writeLine(
      `    Weaken-Grow RAM : ${netscript.formatRam(weakenGrowBatchRam)}`
    );

    const growBatchThreads = netscript.formulas.hacking.growThreads(
      targetServer,
      player,
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
    logWriter.writeLine(`    Grow threads : ${growBatchThreads}`);
    logWriter.writeLine(`    Grow RAM : ${netscript.formatRam(growBatchRam)}`);

    const weakenHackBatchThreads = weakenThreadsRequired(
      growBatchSecurityIncrease
    );
    const weakenHackBatchRam = getRequiredRam(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      weakenHackBatchThreads
    );
    logWriter.writeLine(`    Weaken-Hack threads : ${weakenHackBatchThreads}`);
    logWriter.writeLine(
      `    Weaken-Hack RAM : ${netscript.formatRam(weakenHackBatchRam)}`
    );

    const hackPercentPerThread = netscript.formulas.hacking.hackPercent(
      targetServer,
      player
    );
    const hackBatchThreads = Math.max(
      0,
      Math.floor(targetFundsPercent / hackPercentPerThread)
    );
    const hackBatchRam = getRequiredRam(
      netscript,
      HACK_WORKER_SCRIPT,
      hackBatchThreads
    );
    logWriter.writeLine(`    Hack threads : ${hackBatchThreads}`);
    logWriter.writeLine(`    Hack RAM : ${netscript.formatRam(hackBatchRam)}`);

    const totalRamRequired =
      weakenGrowBatchRam + growBatchRam + weakenHackBatchRam + hackBatchRam;
    logWriter.writeLine(
      `    Total RAM : ${netscript.formatRam(totalRamRequired)}`
    );

    // Determine if Total Ram can be satisfied by accessible servers (max ram) ; if not then skip
    const attackHosts = scanWideNetwork(
      netscript,
      includeHomeAttacker,
      true,
      true
    );
    const totalAttackMaxRam = getTotalMaxRam(netscript, attackHosts);
    if (totalAttackMaxRam < totalRamRequired) {
      logWriter.writeLine(
        '  Required RAM not satisfied by accessible servers.  Skipping target!'
      );
      logWriter.writeLine(
        `    Required RAM : ${netscript.formatRam(totalRamRequired)}`
      );
      logWriter.writeLine(
        `    Max accessible server RAM : ${netscript.formatRam(
          totalAttackMaxRam
        )}`
      );
      continue;
    }

    // Determine if Total Ram can be satisifed with available ram on servers ; if not then wait until Total Ram is available
    let totalAvailableRam = getTotalAvailableRam(netscript, attackHosts);
    if (totalAvailableRam < totalRamRequired) {
      logWriter.writeLine('  Waiting for required RAM to become available...');
      logWriter.writeLine(
        `    Required RAM : ${netscript.formatRam(totalRamRequired)}`
      );
      logWriter.writeLine(
        `    Max accessible server RAM : ${netscript.formatRam(
          totalAvailableRam
        )}`
      );
      while (totalAvailableRam < totalRamRequired) {
        await netscript.asleep(DEFAULT_SLEEP_FOR_RAM);
        totalAvailableRam = getTotalAvailableRam(netscript, attackHosts);
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
    logWriter.writeLine(
      `    Weaken-Grow delay : ${convertMillisecToTime(weakenGrowBatchDelay)}`
    );
    logWriter.writeLine(
      `    Grow delay : ${convertMillisecToTime(growBatchDelay)}`
    );
    logWriter.writeLine(
      `    Weaken-Hack delay : ${convertMillisecToTime(weakenHackBatchDelay)}`
    );
    logWriter.writeLine(
      `    Hack delay : ${convertMillisecToTime(hackBatchDelay)}`
    );

    // Execute scripts with appropriate delays
    logWriter.writeLine('  Executing worker scripts...');
    const weakenGrowBatchPids = runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      weakenGrowBatchThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      weakenGrowBatchDelay
    );
    const growBatchPids = runWorkerScript(
      netscript,
      GROW_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      growBatchThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      growBatchDelay
    );
    const weakenHackBatchPids = runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      weakenHackBatchThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      weakenHackBatchDelay
    );
    const hackBatchPids = runWorkerScript(
      netscript,
      HACK_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      false,
      hackBatchThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostname,
      getCmdFlag(CMD_FLAG_DELAY),
      hackBatchDelay
    );
    workerPids.push(...weakenGrowBatchPids);
    workerPids.push(...growBatchPids);
    workerPids.push(...weakenHackBatchPids);
    workerPids.push(...hackBatchPids);

    const batchExecutionTime = hackBatchDelay + targetDetails.hackTime;
    if (longestBatchTime < batchExecutionTime) {
      longestBatchTime = batchExecutionTime;
    }

    logWriter.writeLine(
      `  Estimated batch completion ~${convertMillisecToTime(
        batchExecutionTime
      )}`
    );
    logWriter.writeLine(ENTRY_DIVIDER);
  }

  // Wait for all batches to complete before scheduling the next set
  logWriter.writeLine(
    `Longest batch completion ~${convertMillisecToTime(longestBatchTime)}`
  );
  logWriter.writeLine('Waiting for all batches to complete...');
  await waitForScripts(netscript, workerPids);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Weaken-Grow Weaken-Hack Batch Manager');
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
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

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
