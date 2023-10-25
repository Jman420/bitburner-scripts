import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';
import {
  CmdArgsSchema,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

const CMD_FLAG_PLAINTEXT = 'plaintext';
const CMD_FLAG_SHIFT = 'shift';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_PLAINTEXT, ''],
  [CMD_FLAG_SHIFT, 0],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'rotation-cipher',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Encrypt with Rotation Cipher');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const plaintext = cmdArgs.plaintext.valueOf() as string;
  let alphaShift = cmdArgs.shift.valueOf() as number;

  logWriter.writeLine(`Plaintext : ${plaintext}`);
  logWriter.writeLine(`Alpha Shift : ${alphaShift}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (alphaShift < 0) {
    // Wrap the shift amount around the alphabet (ie. a shift of -3 is the same as a shift of 23 because 26 chars in ascii alphabet)
    alphaShift += 26;
  }

  const charCodeA = 'A'.charCodeAt(0);
  const charCodeZ = 'Z'.charCodeAt(0);
  let ciphertext = '';
  for (let char of plaintext) {
    if (char !== ' ') {
      const charCode = char.charCodeAt(0);
      let shiftCharCode = charCode + alphaShift;
      if (shiftCharCode > charCodeZ) {
        // Wrap the shifted char code around the alphabet (we use charCodeA - 1 to ensure our first used character is A)
        shiftCharCode = ((charCode + alphaShift) % charCodeZ) + (charCodeA - 1);
      }
      char = String.fromCharCode(shiftCharCode);
    }
    ciphertext += char;
  }
  logWriter.writeLine(`Ciphertext : ${ciphertext}`);
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  return CMD_FLAGS;
}
