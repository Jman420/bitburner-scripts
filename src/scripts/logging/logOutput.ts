import {NS} from '@ns';

import {CmdArgsSchema} from '/scripts/common/shared';

const LOG_WINDOW_CHAR_WIDTH = 50;
const SECTION_DIVIDER = '*'.repeat(LOG_WINDOW_CHAR_WIDTH);
const ENTRY_DIVIDER = '-'.repeat(LOG_WINDOW_CHAR_WIDTH);

function convertMillisecToTime(duration: number) {
  const milliseconds = Math.floor((duration % 1000) / 100);
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  const hoursStr = (hours < 10) ? `0${hours}` : `${hours}`;
  const minutesStr = (minutes < 10) ? `0${minutes}` : `${minutes}`;
  const secondsStr = (seconds < 10) ? "0" + seconds : seconds;

  return hoursStr + ":" + minutesStr + ":" + secondsStr + "." + milliseconds;
}

function logScriptHelp(
  netscript: NS,
  scriptTitle: string,
  description: string,
  cmdArgsSchema: CmdArgsSchema = []
) {
  netscript.tprint(scriptTitle);
  netscript.tprint(description);
  if (cmdArgsSchema.length > 0) {
    netscript.tprint(SECTION_DIVIDER);
    netscript.tprint('Script Command Line Flags');
    for (const entry of cmdArgsSchema) {
      netscript.tprint(`  ${entry[0]} - ${entry[1]}`);
    }
  }
}

export {SECTION_DIVIDER, ENTRY_DIVIDER, convertMillisecToTime, logScriptHelp};
