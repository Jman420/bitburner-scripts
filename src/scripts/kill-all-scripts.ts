import {NS} from '@ns';

import {LogWritersManager} from '/scripts/logging/loggerManager';
import {scanWideNetwork} from '/scripts/workflows/recon';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = new LogWritersManager().getLogger(
    netscript,
    'kill-all-scripts'
  );
  logWriter.writeLine('Kill All Scripts on All Hosts');

  logWriter.writeLine('Scanning wide network for all hosts...');
  const availableHosts = scanWideNetwork(netscript, true);
  logWriter.writeLine(`Found ${availableHosts.length} available hosts`);

  for (const hostname of availableHosts) {
    logWriter.writeLine(`Killing all scripts on host : ${hostname}`);
    netscript.killall(hostname);
  }
}
