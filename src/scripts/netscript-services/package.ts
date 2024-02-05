import {SCRIPTS_DIR} from '/scripts/common/shared';
import {COMMON_PACKAGE} from '/scripts/common/package';
import {WORKFLOWS_PACKAGE} from '/scripts/workflows/package';

const PATH = `${SCRIPTS_DIR}/netscript-services`;
const NETSCRIPT_SERVICES_PACKAGE = COMMON_PACKAGE.concat(
  WORKFLOWS_PACKAGE
).concat([
  `${PATH}/package.js`,
  `${PATH}/shared.js`,
  `${PATH}/netscript-ghost.js`,
  `${PATH}/service-template.js`,
]);

export {NETSCRIPT_SERVICES_PACKAGE};
