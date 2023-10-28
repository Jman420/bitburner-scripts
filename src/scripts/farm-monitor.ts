import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER, getRamAmount} from '/scripts/logging/logOutput';

import {getAvailableRam} from '/scripts/workflows/recon';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'farm-monitor', LoggerMode.TERMINAL);
  logWriter.writeLine('Server Farm Monitor');
  logWriter.writeLine(SECTION_DIVIDER);

  const farmHosts = netscript.getPurchasedServers();
  for (const hostname of farmHosts) {
    const availableRam = getAvailableRam(netscript, hostname);
    const maxRam = netscript.getServerMaxRam(hostname);
    logWriter.writeLine(
      `${hostname} (${getRamAmount(availableRam)} / ${getRamAmount(maxRam)})`
    );
  }
  logWriter.writeLine(SECTION_DIVIDER);
}
