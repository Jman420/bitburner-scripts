import {NS} from '@ns';

import {ServerDetails, analyzeHost} from '/scripts/workflows/recon';
import {runWorkerScript, waitForScripts} from '/scripts/workflows/execution';

import {CMD_ARG_TARGETS_CSV, getCmdArgFlag} from '/scripts/common/shared';
import {WORKERS_PACKAGE} from '/scripts/workers/package';

const WEAKEN_WORKER_SCRIPT = '/scripts/workers/weaken.js';
const GROW_WORKER_SCRIPT = '/scripts/workers/grow.js';
const HACK_WORKER_SCRIPT = '/scripts/workers/hack.js';

async function weakenHost(
  netscript: NS,
  hostDetails: ServerDetails,
  includeHomeAttacker = false
) {
  while (hostDetails.securityLevel > hostDetails.minSecurityLevel) {
    const targetWeaknessReduction =
      hostDetails.securityLevel - hostDetails.minSecurityLevel;
    let requiredThreads = 1;
    while (netscript.weakenAnalyze(requiredThreads) < targetWeaknessReduction) {
      requiredThreads++;
    }

    const scriptPids = runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      requiredThreads,
      includeHomeAttacker,
      getCmdArgFlag(CMD_ARG_TARGETS_CSV),
      hostDetails.hostname
    );
    await waitForScripts(netscript, scriptPids);

    hostDetails = analyzeHost(netscript, hostDetails.hostname);
  }

  return hostDetails;
}

async function growHost(
  netscript: NS,
  hostDetails: ServerDetails,
  includeHomeAttacker = false,
  maxFundsWeight = 1
) {
  const maxFundsLimit = maxFundsWeight * hostDetails.maxFunds;
  while (hostDetails.availableFunds < maxFundsLimit) {
    const requiredFundsMultiplier = maxFundsLimit / hostDetails.availableFunds;
    const requiredThreads = netscript.growthAnalyze(
      hostDetails.hostname,
      requiredFundsMultiplier
    );

    const scriptPids = await runWorkerScript(
      netscript,
      GROW_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      requiredThreads,
      includeHomeAttacker,
      getCmdArgFlag(CMD_ARG_TARGETS_CSV),
      hostDetails.hostname
    );
    await waitForScripts(netscript, scriptPids);

    hostDetails = analyzeHost(netscript, hostDetails.hostname);
  }
  return hostDetails;
}

async function hackHost(
  netscript: NS,
  hostDetails: ServerDetails,
  hackPercent = 0.75,
  includeHomeAttacker = false
) {
  const targetHackFunds = hostDetails.availableFunds * hackPercent;
  const requiredThreads = netscript.hackAnalyzeThreads(
    hostDetails.hostname,
    targetHackFunds
  );
  const scriptPids = await runWorkerScript(
    netscript,
    HACK_WORKER_SCRIPT,
    WORKERS_PACKAGE,
    requiredThreads,
    includeHomeAttacker,
    getCmdArgFlag(CMD_ARG_TARGETS_CSV),
    hostDetails.hostname
  );
  await waitForScripts(netscript, scriptPids);

  hostDetails = analyzeHost(netscript, hostDetails.hostname);
  return {hostDetails: hostDetails, hackedFunds: targetHackFunds};
}

export {weakenHost, growHost, hackHost};
