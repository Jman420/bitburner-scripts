import {SCRIPTS_DIR} from '/scripts/common/shared';
import {WORKFLOWS_PACKAGE} from '/scripts/workflows/package';

const PATH = `${SCRIPTS_DIR}/workers`;
const WORKERS_PACKAGE = WORKFLOWS_PACKAGE.concat([
  `${PATH}/package.js`,
  `${PATH}/grow.js`,
  `${PATH}/hack.js`,
  `${PATH}/share-ram.js`,
  `${PATH}/shared.js`,
  `${PATH}/weaken.js`,
]);

export {WORKERS_PACKAGE};
