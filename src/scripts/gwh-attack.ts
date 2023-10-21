import { NS } from "@ns";

import { LogWritersManager, Logger } from "/scripts/logging/loggerManager";
import { ENTRY_DIVIDER, SECTION_DIVIDER, logServerDetails } from "/scripts/logging/logOutput";

import { scanLocalNetwork, analyzeServer } from "/scripts/workflows/recon";
import { obtainRoot } from "/scripts/workflows/escalation";
import { growWeakenHack } from "/scripts/workflows/attack";
import { infiniteLoop } from "/scripts/workflows/shared";

async function attackNetwork(netscript: NS, logWriter: Logger) {
  const hosts = scanLocalNetwork(netscript);
  logWriter.writeLine(`Found ${hosts.length} available hosts`);

  for (const hostname of hosts) {
    logWriter.writeLine(ENTRY_DIVIDER);
    logWriter.writeLine('Getting Player Level...');
    const playerLevel = netscript.getHackingLevel();

    logWriter.writeLine(`Analyzing server : ${hostname}`);
    const serverDetails = analyzeServer(netscript, hostname);
    logWriter.writeLine(`  Player Level : ${playerLevel}`);
    logServerDetails(logWriter, serverDetails);

    if (!serverDetails.rootAccess) {
      logWriter.writeLine('  Obtaining Root...');
      serverDetails.rootAccess = obtainRoot(netscript, hostname);
    }
    
    if (serverDetails.rootAccess) {
      logWriter.writeLine('  Grow-Weaken-Hack Attacking Server...');
      await growWeakenHack(netscript, serverDetails);
    }
    else {
      logWriter.writeLine('  Unable to Grow-Weaken-Hack Attack ; No root access');
    }
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = new LogWritersManager().getLogger(netscript, 'gwh-attack');
  logWriter.writeLine('Local Network Grow-Weaken-Hack Attack');
  logWriter.writeLine(`Local Host : ${netscript.getHostname()}`);
  logWriter.writeLine(SECTION_DIVIDER);

  await infiniteLoop(attackNetwork, netscript, logWriter);
}
