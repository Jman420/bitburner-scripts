import {SCRIPTS_DIR} from '/scripts/common/shared';
import {COMMON_PACKAGE} from '/scripts/common/package';

const PATH = `${SCRIPTS_DIR}/netscript-services`;
const NETSCRIPT_SERVICES_PACKAGE = COMMON_PACKAGE.concat([
  `${PATH}/package.js`,
  `${PATH}/netscript-locator.js`,
]);

export {NETSCRIPT_SERVICES_PACKAGE};
