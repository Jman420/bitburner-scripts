import {NS} from '@ns';

import {CmdArgsSchema} from '/scripts/common/shared';

import {Logger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {GrowWeakenHackFunction, runGWH} from '/scripts/workflows/execution';
import { CMD_ARG_TARGETS_CSV } from '/scripts/workflows/cmd-args';

const CMD_ARG_DELAY = 'delay';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [
  [CMD_ARG_TARGETS_CSV, ''],
  [CMD_ARG_DELAY, 0],
];

async function runWorker(
  netscript: NS,
  logWriter: Logger,
  gwhFunc: GrowWeakenHackFunction
) {
  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = netscript.flags(CMD_ARGS_SCHEMA);
  const targetHostsCsv = cmdArgs.targetsCsv.valueOf() as string;
  const targetHosts = targetHostsCsv.split(',');
  const delay = cmdArgs.delay.valueOf() as number;

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Delay : ${delay}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine(`Performing worker activity : ${gwhFunc.name}`);
  await runGWH(netscript, gwhFunc, targetHosts, delay);
  logWriter.writeLine(`Worker activity complete : ${gwhFunc.name}`);
}

export {CMD_ARG_DELAY, CMD_ARGS_SCHEMA, runWorker};
