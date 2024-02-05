import {NS} from '@ns';

import {getGhostPackage} from '/scripts/netscript-services/netscript-ghost';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {scanWideNetwork} from '/scripts/workflows/recon';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {initializeScript} from '/scripts/workflows/execution';

const MODULE_NAME = 'contracts-find';
const SUBSCRIBER_NAME = 'contracts-find';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getGhostPackage(netscript);
  const nsLocator = nsPackage.ghost;

  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Find Coding Contracts');
  logWriter.writeLine(SECTION_DIVIDER);

  const availableHosts = scanWideNetwork(netscript);
  for (const hostname of availableHosts) {
    const challengeFiles = await nsLocator['ls'](hostname, '.cct');
    for (const challengePath of challengeFiles) {
      const contractType = await nsLocator.codingcontract['getContractType'](
        challengePath,
        hostname
      );
      logWriter.writeLine(`${hostname} - ${challengePath} : ${contractType}`);
    }
  }
}
