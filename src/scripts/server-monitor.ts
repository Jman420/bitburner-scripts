import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {initializeScript} from '/scripts/workflows/execution';

import {getAvailableRam} from '/scripts/workflows/recon';
import {getGhostPackage} from '/scripts/netscript-services/netscript-ghost';

const MODULE_NAME = 'farm-monitor';
const SUBSCRIBER_NAME = 'farm-monitor';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getGhostPackage(netscript);
  const nsLocator = nsPackage.ghost;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Server Farm Monitor');
  logWriter.writeLine(SECTION_DIVIDER);

  const farmHosts = await nsLocator['getPurchasedServers']();
  for (const hostname of farmHosts) {
    const availableRam = getAvailableRam(netscript, hostname);
    const maxRam = netscript.getServerMaxRam(hostname);
    logWriter.writeLine(
      `${hostname} (${netscript.formatRam(
        availableRam
      )} / ${netscript.formatRam(maxRam)})`
    );
  }
  logWriter.writeLine(SECTION_DIVIDER);
}
