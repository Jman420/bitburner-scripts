type CmdArgsSchema = [string, string | number | boolean | string[]][];

const SCRIPTS_PATH = '/scripts';
const CMD_ARG_PREFIX = '--';
const HOME_SERVER_NAME = 'home';

function getCmdArgFlag(cmdArgName: string) {
  return `${CMD_ARG_PREFIX}${cmdArgName}`;
}

function randomIntWithinRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export {
  CmdArgsSchema,
  SCRIPTS_PATH,
  CMD_ARG_PREFIX,
  HOME_SERVER_NAME,
  getCmdArgFlag,
  randomIntWithinRange,
};
