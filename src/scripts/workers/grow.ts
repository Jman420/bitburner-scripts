import {NS} from '@ns';

import {getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';
import {runWorker} from '/scripts/workers/shared';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'grow-worker');
  logWriter.writeLine('Grow Targets Worker');
  logWriter.writeLine(`Local Host : ${netscript.getHostname()}`);
  logWriter.writeLine(SECTION_DIVIDER);

  await runWorker(netscript, logWriter, netscript.grow);
  logWriter.writeLine(SECTION_DIVIDER);
}
