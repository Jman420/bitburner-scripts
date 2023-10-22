import {NS} from '@ns';

import {randomIntWithinRange} from '/scripts/common/shared';

type GrowWeakenHackFunction = (host: string) => Promise<number>;
type LoopableFunction = (...args: any[]) => Promise<void>;

const MIN_LOOP_DELAY_MILLISEC = 1;
const MAX_LOOP_DELAY_MILLISEC = 100;

async function runGWH(
  netscript: NS,
  gwhFunc: GrowWeakenHackFunction,
  targetHosts: string[],
  delay = 0
) {
  await netscript.sleep(delay);
  for (const hostname of targetHosts) {
    await gwhFunc(hostname);
  }
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
  GrowWeakenHackFunction,
  LoopableFunction,
  MIN_LOOP_DELAY_MILLISEC,
  MAX_LOOP_DELAY_MILLISEC,
  runGWH,
  delayedInfiniteLoop,
  infiniteLoop,
};
