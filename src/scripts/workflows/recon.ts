import {NS} from '@ns';

import {HOME_SERVER_NAME} from '/scripts/common/shared';

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

interface MeanScoreValues {
  hackLevel: number;
  hackTime: number;
  maxFunds: number;
  growRate: number;
  growTime: number;
  weakenTime: number;
}

interface DeviationScoreValues {
  hackLevel: number;
  hackTime: number;
  maxFunds: number;
  growRate: number;
  growTime: number;
  weakenTime: number;
}

interface WeightScoreValues {
  hackLevel: number;
  hackTime: number;
  maxFunds: number;
  growRate: number;
  growTime: number;
  weakenTime: number;
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
  requireRam = false
) {
  const availableHosts = [HOME_SERVER_NAME];
  for (const hostname of availableHosts) {
    netscript
      .scan(hostname)
      .filter(
        host =>
          !rootOnly ||
          (rootOnly &&
            netscript.hasRootAccess(host) &&
            (!requireRam ||
              (requireRam && netscript.getServerMaxRam(host) > 0)))
      )
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

function findServersForRam(
  netscript: NS,
  requiredTotalRam: number,
  requiredMinRam: number,
  includeHome = true
) {
  if (requiredTotalRam < 1) {
    return [];
  }

  const rootedHostsWithRam = scanWideNetwork(
    netscript,
    includeHome,
    true,
    true
  );
  const singleServerWithRam = rootedHostsWithRam.find(
    hostname => getAvailableRam(netscript, hostname) >= requiredTotalRam
  );
  if (singleServerWithRam) {
    return [singleServerWithRam];
  }

  let satisfiedRam = 0;
  const serversWithRam = new Array<string>();
  for (
    let serverCounter = 0;
    serverCounter < rootedHostsWithRam.length &&
    satisfiedRam < requiredTotalRam;
    serverCounter++
  ) {
    const hostname = rootedHostsWithRam[serverCounter];
    const currentServerRam = getAvailableRam(netscript, hostname);
    if (currentServerRam >= requiredMinRam) {
      serversWithRam.push(hostname);
      satisfiedRam += currentServerRam;
    }
  }
  return serversWithRam;
}

function getMeanScoreValues(targetsAnalysis: ServerDetails[]): MeanScoreValues {
  const accumulator = {
    hackLevel: 0,
    hackTime: 0,
    maxFunds: 0,
    growRate: 0,
    growTime: 0,
    weakenTime: 0,
  };
  targetsAnalysis.forEach(value => {
    accumulator.hackLevel += value.hackLevel;
    accumulator.hackTime += value.hackTime;
    accumulator.maxFunds += value.maxFunds;
    accumulator.growRate += value.growRate;
    accumulator.growTime += value.growTime;
    accumulator.weakenTime += value.weakenTime;
  });
  const totalElements = targetsAnalysis.length;
  return {
    hackLevel: accumulator.hackLevel / totalElements,
    hackTime: accumulator.hackTime / totalElements,
    maxFunds: accumulator.maxFunds / totalElements,
    growRate: accumulator.growRate / totalElements,
    growTime: accumulator.growTime / totalElements,
    weakenTime: accumulator.weakenTime / totalElements,
  };
}

function getDeviationScoreValues(
  targetsAnalysis: ServerDetails[],
  meanScoreValues: MeanScoreValues
): DeviationScoreValues {
  const accumulator = {
    hackLevel: 0,
    hackTime: 0,
    maxFunds: 0,
    growRate: 0,
    growTime: 0,
    weakenTime: 0,
  };
  targetsAnalysis.forEach(value => {
    accumulator.hackLevel += Math.pow(
      value.hackLevel - meanScoreValues.hackLevel,
      2
    );
    accumulator.hackTime += Math.pow(
      value.hackTime - meanScoreValues.hackTime,
      2
    );
    accumulator.maxFunds += Math.pow(
      value.maxFunds - meanScoreValues.maxFunds,
      2
    );
    accumulator.growRate += Math.pow(
      value.growRate - meanScoreValues.growRate,
      2
    );
    accumulator.growTime += Math.pow(
      value.growTime - meanScoreValues.growTime,
      2
    );
    accumulator.weakenTime += Math.pow(
      value.weakenTime - meanScoreValues.weakenTime,
      2
    );
  });
  const totalElements = targetsAnalysis.length;
  return {
    hackLevel: Math.sqrt(accumulator.hackLevel / totalElements),
    hackTime: Math.sqrt(accumulator.hackTime / totalElements),
    maxFunds: Math.sqrt(accumulator.maxFunds / totalElements),
    growRate: Math.sqrt(accumulator.growRate / totalElements),
    growTime: Math.sqrt(accumulator.growTime / totalElements),
    weakenTime: Math.sqrt(accumulator.weakenTime / totalElements),
  };
}

function getStandardValue(value: number, mean: number, deviation: number) {
  return (value - mean) / deviation;
}

function scoreHost(
  targetDetails: ServerDetails,
  meanScoreValues: MeanScoreValues,
  deviationScoreValues: DeviationScoreValues,
  weightScoreValues: WeightScoreValues = {
    hackLevel: 1,
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
  }
) {
  targetDetails.score =
    weightScoreValues.hackLevel *
      getStandardValue(
        targetDetails.hackLevel,
        meanScoreValues.hackLevel,
        deviationScoreValues.hackLevel
      ) +
    weightScoreValues.hackTime *
      getStandardValue(
        targetDetails.hackTime,
        meanScoreValues.hackTime,
        deviationScoreValues.hackTime
      ) +
    weightScoreValues.maxFunds *
      getStandardValue(
        targetDetails.maxFunds,
        meanScoreValues.maxFunds,
        deviationScoreValues.maxFunds
      ) +
    weightScoreValues.growRate *
      getStandardValue(
        targetDetails.growRate,
        meanScoreValues.growRate,
        deviationScoreValues.growRate
      ) +
    weightScoreValues.growTime *
      getStandardValue(
        targetDetails.growTime,
        meanScoreValues.growTime,
        deviationScoreValues.growTime
      ) +
    weightScoreValues.weakenTime *
      getStandardValue(
        targetDetails.weakenTime,
        meanScoreValues.weakenTime,
        deviationScoreValues.weakenTime
      );
  return targetDetails.score;
}

function sortOptimalTargetHosts(
  targetsAnalysis: ServerDetails[],
  weightScoreValues: WeightScoreValues = {
    hackLevel: 1,
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
  }
) {
  const meanScoreValues = getMeanScoreValues(targetsAnalysis);
  const deviationScoreValues = getDeviationScoreValues(
    targetsAnalysis,
    meanScoreValues
  );

  targetsAnalysis.sort(
    (hostDetails1, hostDetails2) =>
      scoreHost(
        hostDetails1,
        meanScoreValues,
        deviationScoreValues,
        weightScoreValues
      ) -
      scoreHost(
        hostDetails2,
        meanScoreValues,
        deviationScoreValues,
        weightScoreValues
      )
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
  WeightScoreValues,
  scanLocalNetwork,
  scanWideNetwork,
  findServersForRam,
  scoreHost,
  sortOptimalTargetHosts,
  getAvailableRam,
  canRunScript,
  maxScriptThreads,
  analyzeHost,
};
