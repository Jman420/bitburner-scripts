import {NS} from '@ns';

import {getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

const CMD_ARG_SCRIPT_PATH = 'scriptPath';
const CMD_ARG_DELAY = 'delay';
const CMD_ARG_THREAD_COUNT = 'threadCount';
const CMD_ARG_SCRIPT_ARGS = 'scriptArgs';
const CMD_ARGS_SCHEMA: [string, string | number | boolean | string[]][] = [
  [CMD_ARG_SCRIPT_PATH, ''],
  [CMD_ARG_DELAY, 100],
  [CMD_ARG_THREAD_COUNT, 1],
  [CMD_ARG_SCRIPT_ARGS, []],
];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'delay-script-runner');
  logWriter.writeLine('Delay Script Runner');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = netscript.flags(CMD_ARGS_SCHEMA);
  const scriptPath = cmdArgs.scriptPath.valueOf() as string;
  const delay = cmdArgs.delay.valueOf() as number;
  const threadCount = cmdArgs.threadCount.valueOf() as number;
  const scriptArgs = cmdArgs.scriptArgs.valueOf() as string[];

  logWriter.writeLine(`Script Path : ${scriptPath}`);
  logWriter.writeLine(`Delay : ${delay}`);
  logWriter.writeLine(`Thread Count : ${threadCount}`);
  logWriter.writeLine(`Script Args : ${scriptArgs}`);
  logWriter.writeLine(ENTRY_DIVIDER);

  if (!scriptPath) {
    logWriter.writeLine('No script path provided. ');
    return;
  }
  if (!netscript.fileExists(scriptPath)) {
    logWriter.writeLine(`Provided script path does not exist : ${scriptPath}`);
    return;
  }

  logWriter.writeLine(`Waiting ${delay} milliseconds...`);
  await netscript.sleep(delay);
  logWriter.writeLine(`Executing script : ${scriptPath} ${scriptArgs}`);
  if (netscript.run(scriptPath, threadCount, ...scriptArgs)) {
    logWriter.writeLine('Script executed successfully!');
  }
}

export {
  CMD_ARG_SCRIPT_PATH,
  CMD_ARG_DELAY,
  CMD_ARG_THREAD_COUNT,
  CMD_ARG_SCRIPT_ARGS,
};
