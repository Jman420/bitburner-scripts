import {BasicHGWOptions, NS} from '@ns';

import {
  canRunScript,
  maxScriptThreads,
  scanWideNetwork,
} from '/scripts/workflows/recon';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {ExitEvent} from '/scripts/comms/events/exit-event';

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
    : scanWideNetwork(netscript, {
        includeHome: true,
        rootOnly: true,
        requireRam: true,
      });
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

function initializeScript(netscript: NS, subscriberName: string) {
  netscript.atExit(
    async () => await sendMessage(new ExitEvent(), subscriberName)
  );
}

async function infiniteLoop<FuncType extends LoopableFunction>(
  netscript: NS,
  loopFunction: FuncType,
  delay?: number,
  ...funcArgs: Parameters<FuncType>
) {
  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    await loopFunction(...funcArgs);
    if (delay && delay > 0) {
      await netscript.asleep(delay);
    }
  }
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
  runGWH,
  initializeScript,
  infiniteLoop,
  eventLoop,
};
