import {NS} from '@ns';

import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);
  const nsLocator = nsPackage.locator;

  await nsLocator.tprint('this is a test');
  await nsLocator.tprint('another line');
  console.log(await nsLocator.getPlayer());
  console.log(await nsLocator['getHostname']());
  
  console.log(await nsLocator.codingcontract['getContractTypes']());

  console.log(nsPackage.netscript.getMoneySources());
}
