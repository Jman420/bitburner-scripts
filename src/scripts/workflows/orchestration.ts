import {NS} from '@ns';

import {ServerDetails, analyzeHost} from '/scripts/workflows/recon';
import {runWorkerScript, waitForScripts} from '/scripts/workflows/execution';

import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {getCmdFlag} from '/scripts/workflows/cmd-args';
import {CMD_FLAG_TARGETS_CSV} from '/scripts/workers/shared';

import {sendEvent} from '/scripts/comms/event-comms';
import {WeakenEvent, WeakenStatus} from '/scripts/comms/messages/weaken-event';
import {GrowEvent, GrowStatus} from '/scripts/comms/messages/grow-event';
import {HackEvent, HackStatus} from '/scripts/comms/messages/hack-event';

const WEAKEN_WORKER_SCRIPT = '/scripts/workers/weaken.js';
const GROW_WORKER_SCRIPT = '/scripts/workers/grow.js';
const HACK_WORKER_SCRIPT = '/scripts/workers/hack.js';

function weakenThreadsRequired(netscript: NS, targetReduction: number) {
  let requiredThreads = 1;
  while (netscript.weakenAnalyze(requiredThreads) < targetReduction) {
    requiredThreads++;
  }
  return requiredThreads;
}

async function weakenHost(
  netscript: NS,
  hostDetails: ServerDetails,
  includeHomeAttacker = false
) {
  sendEvent(new WeakenEvent(hostDetails.hostname, WeakenStatus.IN_PROGRESS));

  while (hostDetails.securityLevel > hostDetails.minSecurityLevel) {
    const targetWeaknessReduction =
      hostDetails.securityLevel - hostDetails.minSecurityLevel;
    const requiredThreads = weakenThreadsRequired(
      netscript,
      targetWeaknessReduction
    );

    const scriptPids = runWorkerScript(
      netscript,
      WEAKEN_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      requiredThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostDetails.hostname
    );
    await waitForScripts(netscript, scriptPids);

    hostDetails = analyzeHost(netscript, hostDetails.hostname);
  }

  sendEvent(new WeakenEvent(hostDetails.hostname, WeakenStatus.COMPLETE));
  return hostDetails;
}

function growThreadsRequired(
  netscript: NS,
  hostDetails: ServerDetails,
  targetMultiplier: number
) {
  return netscript.growthAnalyze(hostDetails.hostname, targetMultiplier);
}

async function growHost(
  netscript: NS,
  hostDetails: ServerDetails,
  includeHomeAttacker = false,
  maxFundsWeight = 1
) {
  sendEvent(new GrowEvent(hostDetails.hostname, GrowStatus.IN_PROGRESS));

  const maxFundsLimit = maxFundsWeight * hostDetails.maxFunds;
  while (hostDetails.availableFunds < maxFundsLimit) {
    const requiredFundsMultiplier = maxFundsLimit / hostDetails.availableFunds;
    const requiredThreads = growThreadsRequired(
      netscript,
      hostDetails,
      requiredFundsMultiplier
    );

    const scriptPids = await runWorkerScript(
      netscript,
      GROW_WORKER_SCRIPT,
      WORKERS_PACKAGE,
      requiredThreads,
      includeHomeAttacker,
      getCmdFlag(CMD_FLAG_TARGETS_CSV),
      hostDetails.hostname
    );
    await waitForScripts(netscript, scriptPids);

    hostDetails = analyzeHost(netscript, hostDetails.hostname);
  }

  sendEvent(new GrowEvent(hostDetails.hostname, GrowStatus.COMPLETE));
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
  hackPercent = 0.75,
  includeHomeAttacker = false
) {
  sendEvent(new HackEvent(hostDetails.hostname, HackStatus.IN_PROGRESS));

  const prehackFunds = hostDetails.availableFunds;
  const targetHackFunds = prehackFunds * hackPercent;
  const requiredThreads = hackThreadsRequired(
    netscript,
    hostDetails.hostname,
    targetHackFunds
  );
  const scriptPids = await runWorkerScript(
    netscript,
    HACK_WORKER_SCRIPT,
    WORKERS_PACKAGE,
    requiredThreads,
    includeHomeAttacker,
    getCmdFlag(CMD_FLAG_TARGETS_CSV),
    hostDetails.hostname
  );
  await waitForScripts(netscript, scriptPids);

  sendEvent(new HackEvent(hostDetails.hostname, HackStatus.COMPLETE));
  hostDetails = analyzeHost(netscript, hostDetails.hostname);
  return {
    hostDetails: hostDetails,
    hackedFunds: prehackFunds - hostDetails.availableFunds,
  };
}

export {
  WEAKEN_WORKER_SCRIPT,
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  weakenThreadsRequired,
  weakenHost,
  growThreadsRequired,
  growHost,
  hackThreadsRequired,
  hackHost,
};
