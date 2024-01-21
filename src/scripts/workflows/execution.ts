import {BasicHGWOptions, NS} from '@ns';

import {randomIntWithinRange} from '/scripts/common/shared';

import {copyFiles} from '/scripts/workflows/propagation';
import {
  canRunScript,
  findServersForRam,
  getAvailableRam,
  maxScriptThreads,
  scanWideNetwork,
} from '/scripts/workflows/recon';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {ExitEvent} from '/scripts/comms/events/exit-event';
import {NetscriptPackage} from '/scripts/netscript-services/netscript-locator';
import {
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  WEAKEN_WORKER_SCRIPT,
} from '/scripts/workflows/orchestration';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type LoopableFunction = (...args: any[]) => Promise<void> | void;
type GrowWeakenHackFunction = (
  host: string,
  opts?: BasicHGWOptions
) => Promise<number>;

interface RunScriptOptions {
  hostname?: string;
  threadCount?: number;
  useMaxThreads?: boolean;
  tempScript?: boolean;
  args?: (string | number | boolean)[];
}

const MIN_LOOP_DELAY_MILLISEC = 1;
const MAX_LOOP_DELAY_MILLISEC = 100;
const EVENT_LOOP_DELAY = 1000;

function getRequiredRam(netscript: NS, scriptPath: string, threadCount = 1) {
  const scriptRam = netscript.getScriptRam(scriptPath);
  const requiredRam = scriptRam * threadCount;
  return requiredRam;
}

function runScript(
  netscript: NS,
  scriptName: string,
  runScriptOptions?: RunScriptOptions
) {
  let hostname = runScriptOptions?.hostname;
  if (!hostname) {
    hostname = netscript.getHostname();
  }

  const args = runScriptOptions?.args ?? [];
  if (netscript.isRunning(scriptName, hostname, ...args)) {
    return -1;
  }

  if (!canRunScript(netscript, hostname, scriptName)) {
    return 0;
  }

  const threadCount = runScriptOptions?.useMaxThreads
    ? maxScriptThreads(netscript, hostname, scriptName, false)
    : runScriptOptions?.threadCount ?? 1;
  return netscript.exec(
    scriptName,
    hostname,
    {threads: threadCount, temporary: runScriptOptions?.tempScript},
    ...args
  );
}

function ensureRunning(
  netscript: NS,
  scriptPath: string,
  hostname?: string,
  ...args: string[]
) {
  let scriptPid = -1;
  if (!netscript.isRunning(scriptPath, hostname)) {
    scriptPid = runScript(netscript, scriptPath, {
      hostname: hostname,
      args: args,
    });
  }
  return scriptPid !== 0;
}

function getPid(netscript: NS, scriptPath: string, targetHosts?: string[]) {
  targetHosts = targetHosts
    ? targetHosts
    : scanWideNetwork(netscript, true, true, true);
  for (const hostname of targetHosts) {
    const hostProcesses = netscript.ps(hostname);
    for (const process of hostProcesses) {
      if (process.filename === scriptPath) {
        return process.pid;
      }
    }
  }

  return 0;
}

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
    attackHosts = scanWideNetwork(netscript, includeHome, true, true);
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
    if (scriptPid) {
      scriptPids.push(scriptPid);
      requiredThreads -= hostThreads;
    }
  }

  return scriptPids;
}

async function waitForScripts(
  netscript: NS,
  scriptPids: Array<number>,
  sleepTime = 500
) {
  let scriptsRunning = true;
  while (scriptsRunning) {
    scriptsRunning = false;
    for (const scriptPid of scriptPids) {
      scriptsRunning = (await netscript.isRunning(scriptPid)) || scriptsRunning;
    }

    if (scriptsRunning) {
      await netscript.asleep(sleepTime);
    }
  }
}

async function runGWH(
  netscript: NS,
  gwhFunc: GrowWeakenHackFunction,
  targetHosts: string[],
  delay = 0,
  influenceStocks = false
) {
  await netscript.asleep(delay);
  for (const hostname of targetHosts) {
    await gwhFunc(hostname, {stock: influenceStocks});
  }
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

function initializeScript(netscript: NS, subscriberName: string) {
  netscript.atExit(
    async () => await sendMessage(new ExitEvent(), subscriberName)
  );
}

async function delayedInfiniteLoop<FuncType extends LoopableFunction>(
  netscript: NS,
  delay: number,
  loopFunction: FuncType,
  ...funcArgs: Parameters<FuncType>
) {
  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    await loopFunction(...funcArgs);
    if (delay > 0) {
      await netscript.asleep(delay);
    }
  }
}

async function infiniteLoop<FuncType extends LoopableFunction>(
  netscript: NS,
  loopFunction: FuncType,
  ...funcArgs: Parameters<FuncType>
) {
  const delay = randomIntWithinRange(
    MIN_LOOP_DELAY_MILLISEC,
    MAX_LOOP_DELAY_MILLISEC
  );
  await delayedInfiniteLoop(netscript, delay, loopFunction, ...funcArgs);
}

async function eventLoop(netscript: NS, eventListener: EventListener) {
  let exitFlag = false;
  eventListener.addListener(ExitEvent, () => {
    exitFlag = true;
  });

  while (!exitFlag) {
    await netscript.asleep(EVENT_LOOP_DELAY);
  }
}

export {
  GrowWeakenHackFunction,
  LoopableFunction,
  RunScriptOptions,
  MIN_LOOP_DELAY_MILLISEC,
  MAX_LOOP_DELAY_MILLISEC,
  getRequiredRam,
  runScript,
  ensureRunning,
  getPid,
  runWorkerScript,
  waitForScripts,
  runGWH,
  killWorkerScripts,
  initializeScript,
  delayedInfiniteLoop,
  infiniteLoop,
  eventLoop,
};
