import {NS} from '@ns';

import {getLogger} from '/scripts/logging/loggerManager';
import {scanWideNetwork} from '/scripts/workflows/recon';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'find-contracts'
  );
  logWriter.writeLine('Find Coding Contracts');
  logWriter.writeLine(SECTION_DIVIDER);

  const availableHosts = scanWideNetwork(netscript, false);
  for (const hostname of availableHosts) {
    const challengeFiles = netscript.ls(hostname, '.cct');
    for (const challengePath of challengeFiles) {
      logWriter.writeLine(`${hostname} - ${challengePath}`);
    }
  }
}
