import {NetscriptPackage} from '/scripts/netscript-services/netscript-locator';

async function scoreHostForAttack(
  nsPackage: NetscriptPackage,
  hostname: string,
  hackFundsPercent: number,
  batchCount: number
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const hackFormulas = netscript.formulas.hacking;

  const playerInfo = netscript.getPlayer();
  const serverInfo = await nsLocator['getServer'](hostname);
  const moneyPerBatch = serverInfo.maxRam * hackFundsPercent;
  const hackChance = hackFormulas.hackChance(serverInfo, playerInfo);
  const weakenTime = hackFormulas.weakenTime(serverInfo, playerInfo);

  return (moneyPerBatch * hackChance * batchCount) / weakenTime;
}

export {scoreHostForAttack};
