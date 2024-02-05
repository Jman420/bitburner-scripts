import {NS} from '@ns';

import {
  NetscriptLocator,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';

// https://github.com/bitburner-official/bitburner-src/blob/dev/src/Faction/formulas/favor.ts#L5
function favorToRep(f: number): number {
  const raw = 25000 * (Math.pow(1.02, f) - 1);
  return Math.round(raw * 10000) / 10000;
}

// https://github.com/bitburner-official/bitburner-src/blob/dev/src/Faction/formulas/favor.ts#L10
export function repToFavor(r: number): number {
  const raw = Math.log(r / 25000 + 1) / Math.log(1.02);
  return Math.round(raw * 10000) / 10000;
}

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
  favorToRep,
  repDonationAmount,
  weakenThreadsRequired,
  growThreadsRequired,
  hackThreadsRequired,
};
