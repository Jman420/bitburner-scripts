import {NS} from '@ns';

import {
  ServerDetails,
  analyzeHost,
  findServersForRam,
  getAvailableRam,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {getRequiredRam, runScript} from '/scripts/workflows/execution';

import {WORKERS_PACKAGE} from '/scripts/workers/package';
import {getCmdFlag} from '/scripts/workflows/cmd-args';
import {
  CMD_FLAG_INFLUENCE_STOCKS,
  CMD_FLAG_TARGETS_CSV,
} from '/scripts/workers/shared';
import {NetscriptPackage} from '/scripts/netscript-services/netscript-locator';
import {
  growThreadsRequired,
  hackThreadsRequired,
} from '/scripts/workflows/formulas';
import {copyFiles} from '/scripts/workflows/propagation';

const WEAKEN_WORKER_SCRIPT = '/scripts/workers/weaken.js';
const GROW_WORKER_SCRIPT = '/scripts/workers/grow.js';
const HACK_WORKER_SCRIPT = '/scripts/workers/hack.js';
const SHARE_RAM_WORKER_SCRIPT = '/scripts/workers/share-ram.js';

function runWorkerScript(
  netscript: NS,
  scriptPath: string,
  workerPackage: string[],
  useMaxThreads = false,
  requiredThreads = 1,
  includeHome = false,
  ...scriptArgs: (string | number | boolean)[]
) {
  scriptArgs = scriptArgs.filter(value => value !== '');
  requiredThreads = Math.ceil(requiredThreads);

  const requiredRam = getRequiredRam(netscript, scriptPath, requiredThreads);
  const scriptRam = netscript.getScriptRam(scriptPath);

  let attackHosts: string[];
  if (useMaxThreads) {
    attackHosts = scanWideNetwork(netscript, {
      includeHome: includeHome,
      rootOnly: true,
      requireRam: true,
    });
  } else {
    attackHosts = findServersForRam(
      netscript,
      requiredRam,
      scriptRam,
      includeHome
    );
  }

  const scriptPids = [];
  for (const hostname of attackHosts) {
    let hostThreads = Math.floor(
      getAvailableRam(netscript, hostname) / netscript.getScriptRam(scriptPath)
    );
    if (hostThreads > requiredThreads) {
      hostThreads = requiredThreads;
    }
    copyFiles(netscript, workerPackage, hostname);
    const scriptPid = runScript(netscript, scriptPath, {
      hostname: hostname,
      threadCount: hostThreads,
      useMaxThreads: useMaxThreads,
      tempScript: true,
      args: scriptArgs,
    });
    if (scriptPid > 0) {
      scriptPids.push(scriptPid);
      requiredThreads -= hostThreads;
    }
  }

  return scriptPids;
}

async function growHost(
  nsPackage: NetscriptPackage,
  hostDetails: ServerDetails,
  useMaxThreads = true,
  includeHomeAttacker = false,
  maxFundsPercent = 1,
  influenceStocks = false
) {
  const netscript = nsPackage.netscript;

  const maxFundsLimit = maxFundsPercent * hostDetails.maxFunds;
  while (hostDetails.availableFunds < maxFundsLimit) {
    let requiredThreads = 0;
    if (!useMaxThreads) {
      requiredThreads = await growThreadsRequired(
        nsPackage,
        hostDetails.hostname,
        maxFundsLimit
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

async function hackHost(
  nsPackage: NetscriptPackage,
  hostDetails: ServerDetails,
  useMaxThreads = false,
  includeHomeAttacker = false,
  hackFundsPercent = 0.75,
  influenceStocks = false
) {
  const netscript = nsPackage.netscript;

  const prehackFunds = hostDetails.availableFunds;
  let requiredThreads = 0;
  if (!useMaxThreads) {
    requiredThreads = await hackThreadsRequired(
      nsPackage,
      hostDetails.hostname,
      hackFundsPercent
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

async function waitForScripts(
  netscript: NS,
  scriptPids: number[],
  sleepTime = 500
) {
  let scriptsRunning = true;
  while (scriptsRunning) {
    scriptsRunning = false;
    for (const scriptPid of scriptPids) {
      scriptsRunning = netscript.isRunning(scriptPid) || scriptsRunning;
    }

    if (scriptsRunning) {
      await netscript.asleep(sleepTime);
    }
  }
}

async function waitForWorkers(netscript: NS, scriptPids: number[]) {
  const scriptPromises = scriptPids.map(value =>
    netscript.getPortHandle(value).nextWrite()
  );
  await Promise.all(scriptPromises);
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
  await nsLocator['scriptKill'](SHARE_RAM_WORKER_SCRIPT, hostname);
}

export {
  WEAKEN_WORKER_SCRIPT,
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  SHARE_RAM_WORKER_SCRIPT,
  runWorkerScript,
  growHost,
  hackHost,
  waitForScripts,
  waitForWorkers,
  killWorkerScripts,
};
