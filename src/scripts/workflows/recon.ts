import { NS } from "@ns";

import { HOME_SERVER_NAME } from "/scripts/workflows/shared";

interface ServerDetails {
  hostname: string;
  securityLevel: number;
  minSecurityLevel: number;
  availableFunds: number;
  maxFunds: number;
  requiredPorts: number;
  requiredLevel: number;
  rootAccess: boolean;
}

function scanLocalNetwork(netscript: NS, includeHome: boolean = false) {
  const availableHosts = netscript.scan();
  const homeServerIndex = availableHosts.indexOf(HOME_SERVER_NAME);
  if (!includeHome && homeServerIndex) {
    availableHosts.splice(homeServerIndex, 1);
  }

  return availableHosts;
}

function scanWideNetwork(netscript: NS, includeHome: boolean = false) {
  const availableHosts = [ HOME_SERVER_NAME ];
  for (var hostCounter = 0; hostCounter < availableHosts.length; hostCounter++) {
    netscript.scan(availableHosts[hostCounter]).forEach(host => !availableHosts.includes(host) ? availableHosts.push(host) : false);
  }
  availableHosts.shift();
  if (includeHome) {
    availableHosts.push(HOME_SERVER_NAME);
  }

  return availableHosts;
}

function getAvailableRam(netscript: NS, hostname: string) {
  return netscript.getServerMaxRam(hostname) - netscript.getServerUsedRam(hostname);
}

function canRunScript(netscript: NS, server: string, scriptName: string, freeRunningScript: boolean = false) {
  var availableRam = getAvailableRam(netscript, server);
  const scriptRam = netscript.getScriptRam(scriptName, server);
  if (freeRunningScript) {
    const runningScript = netscript.getRunningScript();
    availableRam += runningScript?.ramUsage ?? 0;
  }
  
  return scriptRam > 0 && scriptRam <= availableRam;
}

function maxScriptThreads(netscript: NS, hostname: string, scriptPath: string, freeRunningScript: boolean = false, runnerScriptPath: string | undefined = undefined) {
  var availableRam = getAvailableRam(netscript, hostname);
  const scriptRam = netscript.getScriptRam(scriptPath, hostname);
  if (freeRunningScript) {
    const runningScript = netscript.getRunningScript();
    availableRam += runningScript?.ramUsage ?? 0;
  }
  if (runnerScriptPath) {
    const runnerScriptRam = netscript.getScriptRam(runnerScriptPath, hostname);
    availableRam -= runnerScriptRam;
  }
  
  const maxThreads = Math.floor(availableRam / scriptRam);
  return maxThreads;
}

function analyzeServer(netscript: NS, hostname: string) {
  const result: ServerDetails = {
    hostname: hostname,
    securityLevel: netscript.getServerSecurityLevel(hostname),
    minSecurityLevel: netscript.getServerMinSecurityLevel(hostname),
    availableFunds: netscript.getServerMoneyAvailable(hostname),
    maxFunds: netscript.getServerMaxMoney(hostname),
    requiredPorts: netscript.getServerNumPortsRequired(hostname),
    requiredLevel: netscript.getServerRequiredHackingLevel(hostname),
    rootAccess: netscript.hasRootAccess(hostname)
  };
  return result;
}

export {ServerDetails, scanLocalNetwork, scanWideNetwork, getAvailableRam, canRunScript, maxScriptThreads, analyzeServer};
