import {NS} from '@ns';

import {getLogger} from '/scripts/logging/loggerManager';
import {canRunScript, maxScriptThreads} from '/scripts/workflows/recon';

function copyFiles(netscript: NS, filePaths: string[], hostname: string) {
  netscript.scp(filePaths, hostname);
}

function runScript(
  netscript: NS,
  scriptName: string,
  hostname: string | undefined = undefined,
  maxThreads = true,
  ...args: (string | number | boolean)[]
) {
  const logWriter = getLogger(netscript, `propagation.${runScript.name}`);
  const serverName = hostname ?? netscript.getHostname();
  if (netscript.isRunning(scriptName, serverName)) {
    logWriter.writeLine(
      `  Script ${scriptName} already running on ${serverName}`
    );
    return false;
  }

  if (!canRunScript(netscript, serverName, scriptName)) {
    logWriter.writeLine(
      `  Unable to run script ${scriptName} on ${serverName}!`
    );
    return false;
  }

  const threadCount = maxThreads
    ? maxScriptThreads(netscript, serverName, scriptName, false)
    : 1;
  netscript.exec(scriptName, serverName, threadCount, ...args);
  return true;
}

function spawnScript(
  netscript: NS,
  scriptName: string,
  delay: number,
  maxThreads = true,
  ...args: (string | number | boolean)[]
) {
  const logWriter = getLogger(netscript, `propagation.${spawnScript.name}`);
  const serverName = netscript.getHostname();
  if (netscript.isRunning(scriptName, serverName)) {
    logWriter.writeLine(
      `  Script ${scriptName} already running on ${serverName}`
    );
    return false;
  }

  if (!canRunScript(netscript, serverName, scriptName, true)) {
    logWriter.writeLine(
      `  Unable to run script ${scriptName} on ${serverName}!`
    );
    return false;
  }

  const threadCount = maxThreads
    ? maxScriptThreads(netscript, serverName, scriptName, true)
    : 1;
  netscript.spawn(scriptName, threadCount, delay, ...args);
  return true;
}

export {copyFiles, runScript, spawnScript};
