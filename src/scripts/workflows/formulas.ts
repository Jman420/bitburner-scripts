import {NS} from '@ns';

import {
  NetscriptLocator,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';

function repDonationAmount(netscript: NS, repAmount: number) {
  const playerInfo = netscript.getPlayer();
  return (repAmount * 10 ** 6) / playerInfo.mults.faction_rep;
}

async function weakenThreadsRequired(
  nsLocator: NetscriptLocator,
  targetReduction: number
) {
  return Math.ceil(targetReduction / (await nsLocator['weakenAnalyze'](1)));
}

async function growThreadsRequired(
  nsPackage: NetscriptPackage,
  hostname: string,
  targetFunds: number
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const playerInfo = netscript.getPlayer();
  const serverInfo = await nsLocator['getServer'](hostname);

  return netscript.formulas.hacking.growThreads(
    serverInfo,
    playerInfo,
    targetFunds
  );
}

async function hackThreadsRequired(
  nsPackage: NetscriptPackage,
  hostname: string,
  targetHackFundsPercent: number
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const playerInfo = netscript.getPlayer();
  const serverInfo = await nsLocator['getServer'](hostname);

  const hackPercentPerThread = netscript.formulas.hacking.hackPercent(
    serverInfo,
    playerInfo
  );
  return Math.max(0, Math.floor(targetHackFundsPercent / hackPercentPerThread));
}

export {
  repDonationAmount,
  weakenThreadsRequired,
  growThreadsRequired,
  hackThreadsRequired,
};
