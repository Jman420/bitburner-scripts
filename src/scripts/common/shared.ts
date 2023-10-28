const SCRIPTS_PATH = '/scripts';
const HOME_SERVER_NAME = 'home';

function randomIntWithinRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function removeEmptyString(value: string) {
  return value !== '';
}

function isPowerOf2(value: number) {
  return Math.log2(value) % 1 === 0;
}

export {
  SCRIPTS_PATH,
  HOME_SERVER_NAME,
  randomIntWithinRange,
  removeEmptyString,
  isPowerOf2,
};
