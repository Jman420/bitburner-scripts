import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {scanWideNetwork} from '/scripts/workflows/recon';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'remove-all-scripts',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Remove All Scripts on All Hosts');

  logWriter.writeLine('Scanning wide network for all hosts...');
  const availableHosts = scanWideNetwork(netscript, false);
  logWriter.writeLine(`Found ${availableHosts.length} available hosts`);

  for (const hostname of availableHosts) {
    logWriter.writeLine(`Removing all scripts on host : ${hostname}`);
    const scriptPaths = netscript.ls(hostname, '/scripts/');
    logWriter.writeLine(
      `  Found ${scriptPaths.length} script files for removal...`
    );
    for (const scriptFilePath of scriptPaths) {
      if (!netscript.rm(scriptFilePath, hostname)) {
        logWriter.writeLine(`  Failed to remove script ${scriptFilePath}`);
      }
    }
  }
}
