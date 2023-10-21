import {NS} from '@ns';

import {LogWritersManager} from '/scripts/logging/loggerManager';
import {ServerDetails} from '/scripts/workflows/recon';

async function growWeakenHack(
  netscript: NS,
  serverDetails: ServerDetails,
  securityLimitMultiplier = 1,
  fundsLimitMultiplier = 1
) {
  const logWriter = new LogWritersManager().getLogger(
    netscript,
    `attack.${growWeakenHack.name}`
  );
  if (!serverDetails.rootAccess) {
    logWriter.writeLine(
      'Cannot perform Grow-Weaken-Hack attack; root access required.'
    );
    return;
  }

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
    serverDetails.requiredLevel <= playerLevel &&
    serverDetails.securityLevel <=
      serverDetails.minSecurityLevel * securityLimitMultiplier &&
    serverDetails.availableFunds >=
      serverDetails.maxFunds * fundsLimitMultiplier
  ) {
    await netscript.hack(serverName);
  }
}

export {growWeakenHack};
