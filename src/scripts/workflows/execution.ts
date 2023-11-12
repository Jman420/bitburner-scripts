import {BasicHGWOptions, NS} from '@ns';

import {randomIntWithinRange} from '/scripts/common/shared';

import {copyFiles} from '/scripts/workflows/propagation';
import {
  canRunScript,
  findServersForRam,
  getAvailableRam,
  maxScriptThreads,
} from '/scripts/workflows/recon';

import {EventListener} from '/scripts/comms/event-comms';
import {ExitEvent} from '/scripts/comms/events/exit-event';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type LoopableFunction = (...args: any[]) => Promise<void> | void;
type GrowWeakenHackFunction = (
  host: string,
  opts?: BasicHGWOptions
) => Promise<number>;

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
  hostname: string,
  threadCount = 1,
  maxThreads = false,
  ...args: (string | number | boolean)[]
) {
  if (netscript.isRunning(scriptName, hostname)) {
    return -1;
  }

  if (!canRunScript(netscript, hostname, scriptName)) {
    return 0;
  }

  threadCount = maxThreads
    ? maxScriptThreads(netscript, hostname, scriptName, false)
    : threadCount;
  return netscript.exec(scriptName, hostname, threadCount, ...args);
}

function runWorkerScript(
  netscript: NS,
  scriptPath: string,
  workerPackage: string[],
  requiredThreads = 1,
  includeHome = false,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ...scriptArgs: any[]
) {
  requiredThreads = Math.ceil(requiredThreads);
  const requiredRam = getRequiredRam(netscript, scriptPath, requiredThreads);
  const scriptRam = netscript.getScriptRam(scriptPath);
  const attackHosts = findServersForRam(
    netscript,
    requiredRam,
    scriptRam,
    includeHome
  );

  const scriptPids = new Array<number>();
  for (const attackerHostname of attackHosts) {
    let hostThreads = Math.floor(
      getAvailableRam(netscript, attackerHostname) /
        netscript.getScriptRam(scriptPath)
    );
    if (hostThreads > requiredThreads) {
      hostThreads = requiredThreads;
    }
    copyFiles(netscript, workerPackage, attackerHostname);
    const scriptPid = runScript(
      netscript,
      scriptPath,
      attackerHostname,
      hostThreads,
      false,
      ...scriptArgs
    );
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

async function delayedInfiniteLoop<FuncType extends LoopableFunction>(
  netscript: NS,
  delay: number,
  loopFunction: FuncType,
  ...funcArgs: Parameters<FuncType>
) {
  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    await loopFunction(...funcArgs);
    await netscript.asleep(delay);
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
  MIN_LOOP_DELAY_MILLISEC,
  MAX_LOOP_DELAY_MILLISEC,
  getRequiredRam,
  runScript,
  runWorkerScript,
  waitForScripts,
  runGWH,
  delayedInfiniteLoop,
  infiniteLoop,
  eventLoop,
};
