type CmdArgsSchema = [string, string | number | boolean | string[]][];

const SCRIPTS_PATH = '/scripts';
const HOME_SERVER_NAME = 'home';

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
  randomIntWithinRange,
  removeEmptyString,
};
