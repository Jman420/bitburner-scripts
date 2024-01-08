import {NS} from '@ns';

import { getLocator } from '/scripts/netscript-services/netscript-locator';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  netscript = getLocator(netscript);

  netscript.tprint('this is a test');
  console.log(netscript['getPlayer']());
  console.log(netscript['getHostname']());

  
}
