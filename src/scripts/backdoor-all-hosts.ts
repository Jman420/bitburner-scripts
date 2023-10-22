import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {scanWideNetwork} from '/scripts/workflows/recon';
import {installBackdoor} from '/scripts/workflows/escalation';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'backdoor-all-hosts',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Backdoor All Available Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Getting all backdoorable hosts...');
  const availableHosts = scanWideNetwork(netscript, false, false);
  const playerLevel = netscript.getHackingLevel();
  const rootableHosts = availableHosts.filter(
    host =>
      !netscript.hasRootAccess(host) &&
      netscript.getServerRequiredHackingLevel(host) <= playerLevel
  );
  logWriter.writeLine(`Found ${rootableHosts.length} backdoorable hosts...`);
  logWriter.writeLine(SECTION_DIVIDER);

  for (const hostname of rootableHosts) {
    logWriter.writeLine(`Installing backdoor on ${hostname}`);
    installBackdoor(netscript, hostname);
  }
  logWriter.writeLine(
    'Successfully installed backdoor on all backdoorable hosts.'
  );
}
