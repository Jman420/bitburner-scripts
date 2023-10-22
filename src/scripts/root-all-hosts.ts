import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {scanWideNetwork} from '/scripts/workflows/recon';
import {getRootTools, obtainRoot} from '/scripts/workflows/escalation';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'root-all-hosts', LoggerMode.TERMINAL);
  logWriter.writeLine('Root All Available Hosts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Getting all rootable hosts...');
  const availableHosts = scanWideNetwork(netscript, false, false);
  const rootTools = getRootTools(netscript);
  const rootableHosts = availableHosts.filter(
    host =>
      !netscript.hasRootAccess(host) &&
      netscript.getServerNumPortsRequired(host) <= rootTools.length
  );
  logWriter.writeLine(`Found ${rootableHosts.length} rootable hosts...`);
  logWriter.writeLine(SECTION_DIVIDER);

  for (const hostname of rootableHosts) {
    logWriter.writeLine(`Obtaining root on ${hostname}`);
    obtainRoot(netscript, hostname);
  }
  logWriter.writeLine('Successfully obtained root on all rootable hosts.');
}
