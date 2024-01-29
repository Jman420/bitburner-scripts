import {NS} from '@ns';

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

export {favorToRep, repDonationAmount};
