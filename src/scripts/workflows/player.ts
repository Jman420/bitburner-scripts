import {NetscriptPackage} from '/scripts/netscript-services/netscript-locator';

import {getPortfolioValue} from '/scripts/workflows/stocks';

async function getPlayerTotalValue(nsPackage: NetscriptPackage) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const portfolioValue = netscript.stock.hasTIXAPIAccess()
    ? await getPortfolioValue(nsLocator)
    : 0;
  const playerInfo = netscript.getPlayer();
  return playerInfo.money + portfolioValue;
}

export {getPlayerTotalValue};
