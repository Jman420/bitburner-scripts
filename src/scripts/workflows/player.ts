import {NetscriptPackage} from '/scripts/netscript-services/netscript-locator';

import {getPortfolioValue} from '/scripts/workflows/stocks';

async function getPlayerTotalValue(nsPackage: NetscriptPackage) {
  const netscript = nsPackage.netscript;

  const portfolioMetrics = await getPortfolioValue(nsPackage);
  const playerInfo = netscript.getPlayer();
  return playerInfo.money + portfolioMetrics.totalValue;
}

export {getPlayerTotalValue};
