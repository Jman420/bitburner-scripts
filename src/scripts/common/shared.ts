type CmdArgsSchema = [string, string | number | boolean | string[]][];

const SCRIPTS_PATH = '/scripts';
const HOME_SERVER_NAME = 'home';

const CMD_ARG_PREFIX = '--';
const CMD_ARG_TARGETS_CSV = 'targetsCsv';

function getCmdArgFlag(cmdArgName: string) {
  return `${CMD_ARG_PREFIX}${cmdArgName}`;
}

function randomIntWithinRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function removeEmptyString(value: string) {
  return value !== '';
}

export {
  CmdArgsSchema,
  SCRIPTS_PATH,
  HOME_SERVER_NAME,
  CMD_ARG_PREFIX,
  CMD_ARG_TARGETS_CSV,
  getCmdArgFlag,
  randomIntWithinRange,
  removeEmptyString,
};
