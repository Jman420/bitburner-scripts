import {NS} from '@ns';

import {CmdArgsSchema} from '/scripts/common/shared';

import {Logger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {GrowWeakenHackFunction, runGWH} from '/scripts/workflows/execution';

const CMD_ARG_TARGETS = 'targets';
const CMD_ARG_DELAY = 'delay';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [
  [CMD_ARG_TARGETS, []],
  [CMD_ARG_DELAY, 0],
];

async function runWorker(
  netscript: NS,
  logWriter: Logger,
  gwhFunc: GrowWeakenHackFunction
) {
  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = netscript.flags(CMD_ARGS_SCHEMA);
  const targetHosts = cmdArgs.targets.valueOf() as string[];
  const delay = cmdArgs.delay.valueOf() as number;

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Delay : ${delay}`);
  logWriter.writeLine(SECTION_DIVIDER);

  runGWH(netscript, gwhFunc, targetHosts, delay);
}

export {CMD_ARG_TARGETS, CMD_ARG_DELAY, CMD_ARGS_SCHEMA, runWorker};
