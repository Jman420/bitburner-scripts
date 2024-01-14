import {NS} from '@ns';

import {HOME_SERVER_NAME, NETSCRIPT_SERVER_NAME} from '/scripts/common/shared';

interface ServerDetails {
  hostname: string;
  securityLevel: number;
  minSecurityLevel: number;
  availableFunds: number;
  maxFunds: number;
  requiredPorts: number;
  hackLevel: number;
  hackTime: number;
  growRate: number;
  growTime: number;
  weakenTime: number;
  score?: number;
}

function scanLocalNetwork(
  netscript: NS,
  hostname?: string,
  includeHome = false,
  rootOnly = false
) {
  const availableHosts = netscript
    .scan(hostname)
    .filter(host => !rootOnly || (rootOnly && netscript.hasRootAccess(host)));
  const homeServerIndex = availableHosts.indexOf(HOME_SERVER_NAME);
  if (!includeHome && homeServerIndex > -1) {
    availableHosts.splice(homeServerIndex, 1);
  }

  return availableHosts;
}

function scanWideNetwork(
  netscript: NS,
  includeHome = false,
  rootOnly = false,
  requireRam = false,
  requireFunds = false
) {
  let availableHosts = [HOME_SERVER_NAME];
  for (const hostname of availableHosts) {
    netscript
      .scan(hostname)
      .forEach(host =>
        !availableHosts.includes(host) ? availableHosts.push(host) : undefined
      );
  }
  availableHosts.shift();
  availableHosts = availableHosts.filter(
    host =>
      (!rootOnly || (rootOnly && netscript.hasRootAccess(host))) &&
      (!requireRam || (requireRam && netscript.getServerMaxRam(host) > 0)) &&
      (!requireFunds ||
        (requireFunds && netscript.getServerMaxMoney(host) > 0)) &&
      host !== NETSCRIPT_SERVER_NAME
  );
  if (includeHome) {
    availableHosts.unshift(HOME_SERVER_NAME);
  }

  return availableHosts;
}

function filterHostsCanHack(
  netscript: NS,
  targetHosts: string[],
  hackChanceLimit = 0.75
) {
  return targetHosts.filter(
    host =>
      netscript.getServerRequiredHackingLevel(host) <=
        netscript.getHackingLevel() &&
      netscript.hackAnalyzeChance(host) >= hackChanceLimit
  );
}

function findHostPath(
  netscript: NS,
  hostname: string,
  targetHost: string,
  path: string[] = [],
  traversedHosts: string[] = []
) {
  if (hostname === targetHost) {
    path.unshift(hostname);
    return path;
  }

  traversedHosts.push(hostname);
  const localHosts = scanLocalNetwork(netscript, hostname, false, false).filter(
    value => !traversedHosts.includes(value)
  );
  for (const nextHost of localHosts) {
    if (findHostPath(netscript, nextHost, targetHost, path, traversedHosts)) {
      path.unshift(hostname);
      return path;
    }
  }
  return undefined;
}

function findServersForRam(
  netscript: NS,
  requiredTotalRam: number,
  requiredMinRam: number,
  includeHome = true,
  targetHosts?: string[]
) {
  if (requiredTotalRam < 1) {
    return [];
  }

  if (!targetHosts) {
    targetHosts = scanWideNetwork(netscript, includeHome, true, true);
  }

  let satisfiedRam = 0;
  const serversWithRam = new Array<string>();
  for (
    let serverCounter = 0;
    serverCounter < targetHosts.length && satisfiedRam < requiredTotalRam;
    serverCounter++
  ) {
    const hostname = targetHosts[serverCounter];
    const currentServerRam = getAvailableRam(netscript, hostname);
    if (currentServerRam >= requiredMinRam) {
      serversWithRam.push(hostname);
      satisfiedRam += currentServerRam;
    }
  }

  return serversWithRam;
}

function getTotalMaxRam(netscript: NS, targetHosts: string[]) {
  if (targetHosts.length < 1) {
    targetHosts = scanWideNetwork(netscript, true, true, true, false);
  }

  let result = 0;
  for (const hostname of targetHosts) {
    result += netscript.getServerMaxRam(hostname);
  }
  return result;
}

function getAvailableRam(netscript: NS, hostname: string) {
  return (
    netscript.getServerMaxRam(hostname) - netscript.getServerUsedRam(hostname)
  );
}

function getTotalAvailableRam(netscript: NS, targetHosts: string[]) {
  return targetHosts
    .map(hostname => getAvailableRam(netscript, hostname))
    .reduce((aggregateValue, currentValue) => (aggregateValue += currentValue));
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

function analyzeHost(netscript: NS, hostname: string) {
  const result: ServerDetails = {
    hostname: hostname,
    securityLevel: netscript.getServerSecurityLevel(hostname),
    minSecurityLevel: netscript.getServerMinSecurityLevel(hostname),
    availableFunds: netscript.getServerMoneyAvailable(hostname),
    maxFunds: netscript.getServerMaxMoney(hostname),
    requiredPorts: netscript.getServerNumPortsRequired(hostname),
    weakenTime: netscript.getWeakenTime(hostname),
    growRate: netscript.getServerGrowth(hostname),
    growTime: netscript.getGrowTime(hostname),
    hackLevel: netscript.getServerRequiredHackingLevel(hostname),
    hackTime: netscript.getHackTime(hostname),
  };
  return result;
}

export {
  ServerDetails,
  scanLocalNetwork,
  scanWideNetwork,
  filterHostsCanHack,
  findHostPath,
  findServersForRam,
  getTotalMaxRam,
  getAvailableRam,
  getTotalAvailableRam,
  canRunScript,
  maxScriptThreads,
  analyzeHost,
};
