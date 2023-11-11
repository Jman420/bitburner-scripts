import {NS} from '@ns';

import {getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';
import {infiniteLoop} from '/scripts/workflows/execution';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'share-ram-worker');
  logWriter.writeLine('Share Ram Worker');
  logWriter.writeLine(`Local Host : ${netscript.getHostname()}`);
  logWriter.writeLine(SECTION_DIVIDER);

  await infiniteLoop(netscript, async () => await netscript.share());
  logWriter.writeLine(SECTION_DIVIDER);
}
