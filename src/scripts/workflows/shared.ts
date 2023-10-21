import {NS} from '@ns';

type LoopableFunction = (...args: any[]) => Promise<void>;
type SleepFunction = (milliseconds: number) => Promise<true>;

const CMD_ARG_PREFIX = '--';
const HOME_SERVER_NAME = 'home';
const MIN_LOOP_DELAY_MILLISEC = 1;
const MAX_LOOP_DELAY_MILLISEC = 100;

function getCmdArgFlag(cmdArgName: string) {
  return `${CMD_ARG_PREFIX}${cmdArgName}`;
}

function randomIntWithinRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function delayedInfiniteLoop(
  netscript: NS,
  delay: number,
  loopFunction: LoopableFunction,
  ...funcArgs: any[]
) {
  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    await loopFunction(...funcArgs);
    await netscript.sleep(delay);
  }
}

async function infiniteLoop(
  netscript: NS,
  loopFunction: LoopableFunction,
  ...funcArgs: any[]
) {
  const delay = randomIntWithinRange(
    MIN_LOOP_DELAY_MILLISEC,
    MAX_LOOP_DELAY_MILLISEC
  );
  await delayedInfiniteLoop(netscript, delay, loopFunction, ...funcArgs);
}

export {
  LoopableFunction,
  SleepFunction,
  CMD_ARG_PREFIX,
  HOME_SERVER_NAME,
  MIN_LOOP_DELAY_MILLISEC,
  MAX_LOOP_DELAY_MILLISEC,
  getCmdArgFlag,
  randomIntWithinRange,
  delayedInfiniteLoop,
  infiniteLoop,
};
