import {CityName} from '@ns';

const SCRIPTS_DIR = 'scripts';

const HOME_SERVER_NAME = 'home';
const NETSCRIPT_SERVER_NAME = 'server-lambda';
const BASE_RAM_COST = 1.6;

const CITY_NAMES = [
  'Aevum',
  'Chongqing',
  'Sector-12',
  'New Tokyo',
  'Ishima',
  'Volhaven',
] as CityName[];

function isPowerOf2(value: number) {
  return Math.log2(value) % 1 === 0;
}

export {
  SCRIPTS_DIR,
  HOME_SERVER_NAME,
  NETSCRIPT_SERVER_NAME,
  CITY_NAMES,
  BASE_RAM_COST,
  isPowerOf2,
};
