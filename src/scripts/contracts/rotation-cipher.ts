import {NS} from '@ns';

import {CmdArgsSchema} from '/scripts/common/shared';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

const CMD_ARG_PLAINTEXT = 'plaintext';
const CMD_ARG_SHIFT = 'shift';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [
  [CMD_ARG_PLAINTEXT, ''],
  [CMD_ARG_SHIFT, 0],
];

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
  const cmdArgs = netscript.flags(CMD_ARGS_SCHEMA);
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
