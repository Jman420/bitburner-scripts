import {NS} from '@ns';

import {Logger} from '/scripts/logging/loggerManager';

type LoopableFunction = (netscript: NS, logWriter: Logger) => Promise<void>;

const CMD_ARG_PREFIX = '--';
const HOME_SERVER_NAME = 'home';
const MIN_LOOP_SLEEP_MILLISEC = 1;
const MAX_LOOP_SLEEP_MILLISEC = 100;

function getCmdArgFlag(cmdArgName: string) {
  return `${CMD_ARG_PREFIX}${cmdArgName}`;
}

function randomIntWithinRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function infiniteLoop(
  loopFunction: LoopableFunction,
  netscript: NS,
  logWriter: Logger
) {
  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    await loopFunction(netscript, logWriter);

    const sleepTime = randomIntWithinRange(
      MIN_LOOP_SLEEP_MILLISEC,
      MAX_LOOP_SLEEP_MILLISEC
    );
    await netscript.sleep(sleepTime);
  }
}

export {
  CMD_ARG_PREFIX,
  HOME_SERVER_NAME,
  MIN_LOOP_SLEEP_MILLISEC,
  MAX_LOOP_SLEEP_MILLISEC,
  getCmdArgFlag,
  randomIntWithinRange,
  infiniteLoop,
};
