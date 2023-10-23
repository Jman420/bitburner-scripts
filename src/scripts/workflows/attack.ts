import {NS} from '@ns';

import {ServerDetails} from '/scripts/workflows/recon';

async function growWeakenHack(
  netscript: NS,
  serverDetails: ServerDetails,
  securityLimitMultiplier = 1,
  fundsLimitMultiplier = 1
) {
  const playerLevel = netscript.getHackingLevel();
  const serverName = serverDetails.hostname;

  if (serverDetails.availableFunds < serverDetails.maxFunds) {
    await netscript.grow(serverName);
    serverDetails.availableFunds =
      netscript.getServerMoneyAvailable(serverName);
  }
  if (serverDetails.securityLevel > serverDetails.minSecurityLevel) {
    await netscript.weaken(serverName);
    serverDetails.securityLevel = netscript.getServerSecurityLevel(serverName);
  }

  if (
    serverDetails.hackLevel <= playerLevel &&
    serverDetails.securityLevel <=
      serverDetails.minSecurityLevel * securityLimitMultiplier &&
    serverDetails.availableFunds >=
      serverDetails.maxFunds * fundsLimitMultiplier
  ) {
    await netscript.hack(serverName);
  }
}

export {growWeakenHack};
