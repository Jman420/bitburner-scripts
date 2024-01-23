import {NS} from '@ns';

import {getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'share-ram-worker');
  logWriter.writeLine('Share Ram Worker');
  logWriter.writeLine(`Local Host : ${netscript.getHostname()}`);
  logWriter.writeLine(SECTION_DIVIDER);

  await netscript.share();
  logWriter.writeLine(SECTION_DIVIDER);
}
