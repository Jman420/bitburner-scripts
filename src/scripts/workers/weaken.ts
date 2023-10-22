import {NS} from '@ns';

import {getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';
import {runWorker} from '/scripts/workers/shared';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'gwh-manager');
  logWriter.writeLine('Weaken Targets Worker');
  logWriter.writeLine(`Local Host : ${netscript.getHostname()}`);
  logWriter.writeLine(SECTION_DIVIDER);

  runWorker(netscript, logWriter, netscript.weaken);
  logWriter.writeLine(SECTION_DIVIDER);
}
