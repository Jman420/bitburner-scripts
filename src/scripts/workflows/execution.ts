import {NS} from '@ns';

import {randomIntWithinRange} from '/scripts/common/shared';
import {copyFiles, runScript} from '/scripts/workflows/propagation';
import {findServersForRam, getAvailableRam} from '/scripts/workflows/recon';

type GrowWeakenHackFunction = (host: string) => Promise<number>;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type LoopableFunction = (...args: any[]) => Promise<void> | void;

const MIN_LOOP_DELAY_MILLISEC = 1;
const MAX_LOOP_DELAY_MILLISEC = 100;

function getRequiredRam(netscript: NS, scriptPath: string, threadCount = 1) {
  const scriptRam = netscript.getScriptRam(scriptPath);
  const requiredRam = scriptRam * threadCount;
  return requiredRam;
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
      await netscript.sleep(sleepTime);
    }
  }
}

async function runGWH(
  netscript: NS,
  gwhFunc: GrowWeakenHackFunction,
  targetHosts: string[],
  delay = 0
) {
  await netscript.sleep(delay);
  for (const hostname of targetHosts) {
    await gwhFunc(hostname);
  }
}

async function delayedInfiniteLoop(
  netscript: NS,
  delay: number,
  loopFunction: LoopableFunction,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ...funcArgs: any[]
) {
  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    await loopFunction(...funcArgs);
    await netscript.sleep(delay);
  }
}

async function infiniteLoop(
  netscript: NS,
  loopFunction: LoopableFunction,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ...funcArgs: any[]
) {
  const delay = randomIntWithinRange(
    MIN_LOOP_DELAY_MILLISEC,
    MAX_LOOP_DELAY_MILLISEC
  );
  await delayedInfiniteLoop(netscript, delay, loopFunction, ...funcArgs);
}

export {
  GrowWeakenHackFunction,
  LoopableFunction,
  MIN_LOOP_DELAY_MILLISEC,
  MAX_LOOP_DELAY_MILLISEC,
  getRequiredRam,
  runWorkerScript,
  waitForScripts,
  runGWH,
  delayedInfiniteLoop,
  infiniteLoop,
};
