import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

const TRIANGLE_ARRAYS = [[0]];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'triangle-path-sum',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Find Smallest Triangle Path');
  logWriter.writeLine(SECTION_DIVIDER);

  let currentIndex = 0;
  let pathSum = TRIANGLE_ARRAYS[0][currentIndex];
  TRIANGLE_ARRAYS.shift();
  logWriter.writeLine('Key : (Row Index, Value)');
  logWriter.writeLine(`(${currentIndex}, ${pathSum})`);
  for (const row of TRIANGLE_ARRAYS) {
    if (row[currentIndex] > row[currentIndex + 1]) {
      currentIndex += 1;
    }

    const currentValue = row[currentIndex];
    pathSum += currentValue;
    logWriter.writeLine(`(${currentIndex}, ${currentValue})`);
  }
  logWriter.writeLine(SECTION_DIVIDER);
  logWriter.writeLine(`Minimum Path Sum : ${pathSum}`);
}
