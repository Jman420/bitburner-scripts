import {NS} from '@ns';

import {HOME_SERVER_NAME} from '/scripts/common/shared';

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

function scanLocalNetwork(
  netscript: NS,
  includeHome = false,
  rootOnly = false
) {
  const availableHosts = netscript
    .scan()
    .filter(host => !rootOnly || (rootOnly && netscript.hasRootAccess(host)));
  const homeServerIndex = availableHosts.indexOf(HOME_SERVER_NAME);
  if (!includeHome && homeServerIndex) {
    availableHosts.splice(homeServerIndex, 1);
  }

  return availableHosts;
}

function scanWideNetwork(netscript: NS, includeHome = false, rootOnly = false) {
  const availableHosts = [HOME_SERVER_NAME];
  for (const hostname of availableHosts) {
    netscript
      .scan(hostname)
      .filter(host => !rootOnly || (rootOnly && netscript.hasRootAccess(host)))
      .forEach(host =>
        !availableHosts.includes(host) ? availableHosts.push(host) : undefined
      );
  }
  availableHosts.shift();
  if (includeHome) {
    availableHosts.push(HOME_SERVER_NAME);
  }

  return availableHosts;
}

function scoreHost(netscript: NS, hostname: string) {
  // TODO (JMG) : Implement Host Scoring Logic
  return 0;
}

function sortOptimalTargetHosts(netscript: NS, targetHosts: string[]) {
  targetHosts.sort(
    (hostname1, hostname2) =>
      scoreHost(netscript, hostname1) - scoreHost(netscript, hostname2)
  );
}

function getAvailableRam(netscript: NS, hostname: string) {
  return (
    netscript.getServerMaxRam(hostname) - netscript.getServerUsedRam(hostname)
  );
}

function canRunScript(
  netscript: NS,
  server: string,
  scriptName: string,
  freeRunningScript = false
) {
  let availableRam = getAvailableRam(netscript, server);
  const scriptRam = netscript.getScriptRam(scriptName, server);
  if (freeRunningScript) {
    const runningScript = netscript.getRunningScript();
    availableRam += runningScript?.ramUsage ?? 0;
  }

  return scriptRam > 0 && scriptRam <= availableRam;
}

function maxScriptThreads(
  netscript: NS,
  hostname: string,
  scriptPath: string,
  freeRunningScript = false,
  runnerScriptPath: string | undefined = undefined
) {
  let availableRam = getAvailableRam(netscript, hostname);
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
    rootAccess: netscript.hasRootAccess(hostname),
  };
  return result;
}

export {
  ServerDetails,
  scanLocalNetwork,
  scanWideNetwork,
  sortOptimalTargetHosts,
  getAvailableRam,
  canRunScript,
  maxScriptThreads,
  analyzeServer,
};
