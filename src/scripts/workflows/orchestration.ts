import {NS} from '@ns';

import {ServerDetails, analyzeHost} from '/scripts/workflows/recon';
import {runWorkerScript, waitForScripts} from '/scripts/workflows/execution';

import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {getCmdFlag} from '/scripts/workflows/cmd-args';
import {
  CMD_FLAG_INFLUENCE_STOCKS,
  CMD_FLAG_TARGETS_CSV,
} from '/scripts/workers/shared';
import {NetscriptPackage} from '/scripts/netscript-services/netscript-locator';

const WEAKEN_WORKER_SCRIPT = '/scripts/workers/weaken.js';
const GROW_WORKER_SCRIPT = '/scripts/workers/grow.js';
const HACK_WORKER_SCRIPT = '/scripts/workers/hack.js';
const SHARE_RAM_WORKER_SCRIPT = '/scripts/workers/share-ram.js';

const WEAKEN_REDUCTION_AMOUNT = 0.05;

function weakenThreadsRequired(targetReduction: number) {
  return Math.ceil(targetReduction / WEAKEN_REDUCTION_AMOUNT);
}

async function weakenHost(
  netscript: NS,
  hostDetails: ServerDetails,
  useMaxThreads = false,
  includeHomeAttacker = false,
  influenceStocks = false
) {
  while (hostDetails.securityLevel > hostDetails.minSecurityLevel) {
    const targetWeaknessReduction =
      hostDetails.securityLevel - hostDetails.minSecurityLevel;
    let requiredThreads = 0;
    if (!useMaxThreads) {
      requiredThreads = weakenThreadsRequired(targetWeaknessReduction);
    }

    const scriptPids = runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      useMaxThreads,
      requiredThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostDetails.hostname,
      influenceStocks ? getCmdFlag(CMD_FLAG_INFLUENCE_STOCKS) : ''
    );
    await waitForScripts(netscript, scriptPids);

    hostDetails = analyzeHost(netscript, hostDetails.hostname);
  }

  return hostDetails;
}

function growThreadsRequired(
  netscript: NS,
  hostDetails: ServerDetails,
  targetMultiplier: number
) {
  // growthAnalyze() is not accurate in its thread predictions... this will almost always require 2 cycles to fully grow the host
  return netscript.growthAnalyze(hostDetails.hostname, targetMultiplier);
}

async function growHost(
  netscript: NS,
  hostDetails: ServerDetails,
  useMaxThreads = true,
  includeHomeAttacker = false,
  maxFundsPercent = 1,
  influenceStocks = false
) {
  const maxFundsLimit = maxFundsPercent * hostDetails.maxFunds;
  while (hostDetails.availableFunds < maxFundsLimit) {
    const requiredFundsMultiplier = maxFundsLimit / hostDetails.availableFunds;
    let requiredThreads = 0;
    if (!useMaxThreads) {
      requiredThreads = growThreadsRequired(
        netscript,
        hostDetails,
        requiredFundsMultiplier
      );
    }

    const scriptPids = await runWorkerScript(
      netscript,
      GROW_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      useMaxThreads,
      requiredThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostDetails.hostname,
      influenceStocks ? getCmdFlag(CMD_FLAG_INFLUENCE_STOCKS) : ''
    );
    await waitForScripts(netscript, scriptPids);

    hostDetails = analyzeHost(netscript, hostDetails.hostname);
  }

  return hostDetails;
}

function hackThreadsRequired(
  netscript: NS,
  hostname: string,
  targetHackFunds: number
) {
  return netscript.hackAnalyzeThreads(hostname, targetHackFunds);
}

async function hackHost(
  netscript: NS,
  hostDetails: ServerDetails,
  useMaxThreads = false,
  includeHomeAttacker = false,
  hackFundsPercent = 0.75,
  influenceStocks = false
) {
  const prehackFunds = hostDetails.availableFunds;
  const targetHackFunds = prehackFunds * hackFundsPercent;
  let requiredThreads = 0;
  if (!useMaxThreads) {
    requiredThreads = hackThreadsRequired(
      netscript,
      hostDetails.hostname,
      targetHackFunds
    );
  }

  const scriptPids = await runWorkerScript(
    netscript,
    HACK_WORKER_SCRIPT,
    WORKERS_PACKAGE,
    useMaxThreads,
    requiredThreads,
    includeHomeAttacker,
    getCmdFlag(CMD_FLAG_TARGETS_CSV),
    hostDetails.hostname,
    influenceStocks ? getCmdFlag(CMD_FLAG_INFLUENCE_STOCKS) : ''
  );
  await waitForScripts(netscript, scriptPids);

  hostDetails = analyzeHost(netscript, hostDetails.hostname);
  return {
    hostDetails: hostDetails,
    hackedFunds: prehackFunds - hostDetails.availableFunds,
  };
}

async function killWorkerScripts(
  nsPackage: NetscriptPackage,
  hostname?: string
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  if (!hostname) {
    hostname = netscript.getHostname();
  }

  await nsLocator['scriptKill'](WEAKEN_WORKER_SCRIPT, hostname);
  await nsLocator['scriptKill'](GROW_WORKER_SCRIPT, hostname);
  await nsLocator['scriptKill'](HACK_WORKER_SCRIPT, hostname);
}

export {
  WEAKEN_WORKER_SCRIPT,
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  SHARE_RAM_WORKER_SCRIPT,
  weakenThreadsRequired,
  weakenHost,
  growThreadsRequired,
  growHost,
  hackThreadsRequired,
  hackHost,
  killWorkerScripts,
};
