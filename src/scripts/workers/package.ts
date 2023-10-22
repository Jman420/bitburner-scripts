import {SCRIPTS_PATH} from '/scripts/common/shared';

const PATH = `${SCRIPTS_PATH}/workers`;
const WORKERS_PACKAGE = [
  `${PATH}/package.js`,
  `${PATH}/grow.js`,
  `${PATH}/hack.js`,
  `${PATH}/shared.js`,
  `${PATH}/weaken.js`,
];

export {WORKERS_PACKAGE};
