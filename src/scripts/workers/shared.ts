import {NS} from '@ns';

import {Logger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  GrowWeakenHackFunction,
  infiniteLoop,
  runGWH,
} from '/scripts/workflows/execution';
import {CmdArgsSchema, parseCmdFlags} from '/scripts/workflows/cmd-args';

const CMD_FLAG_DELAY = 'delay';
const CMD_FLAG_TARGETS_CSV = 'targetsCsv';
const CMD_FLAG_CONTINUOUS_ATTACK = 'continuousAttack';
const CMD_FLAG_INFLUENCE_STOCKS = 'influenceStocks';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_DELAY, 0],
  [CMD_FLAG_TARGETS_CSV, ''],
  [CMD_FLAG_CONTINUOUS_ATTACK, false],
  [CMD_FLAG_INFLUENCE_STOCKS, false],
];

async function runWorker(
  netscript: NS,
  logWriter: Logger,
  gwhFunc: GrowWeakenHackFunction
) {
  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const delay = cmdArgs[CMD_FLAG_DELAY].valueOf() as number;
  const targetHostsCsv = cmdArgs[CMD_FLAG_TARGETS_CSV].valueOf() as string;
  const targetHosts = targetHostsCsv.split(',');
  const continuousAttack = cmdArgs[
    CMD_FLAG_CONTINUOUS_ATTACK
  ].valueOf() as boolean;
  const influenceStocks = cmdArgs[
    CMD_FLAG_INFLUENCE_STOCKS
  ].valueOf() as boolean;

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(`Delay : ${delay}`);
  logWriter.writeLine(`Continuous Attack : ${continuousAttack}`);
  logWriter.writeLine(`Influence Stocks : ${influenceStocks}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine(`Performing worker activity : ${gwhFunc.name}`);
  if (continuousAttack) {
    await infiniteLoop(
      netscript,
      runGWH,
      netscript,
      gwhFunc,
      targetHosts,
      delay
    );
  } else {
    await runGWH(netscript, gwhFunc, targetHosts, delay);
  }
  logWriter.writeLine(`Worker activity complete : ${gwhFunc.name}`);
}

export {
  CMD_FLAG_DELAY,
  CMD_FLAG_TARGETS_CSV,
  CMD_FLAG_CONTINUOUS_ATTACK,
  CMD_FLAG_INFLUENCE_STOCKS,
  CMD_FLAGS_SCHEMA,
  runWorker,
};
