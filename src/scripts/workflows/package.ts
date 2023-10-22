import {SCRIPTS_PATH} from '/scripts/common/shared';

const PATH = `${SCRIPTS_PATH}/workflows`;
const WORKFLOWS_PACKAGE = [
  `${PATH}/package.js`,
  `${PATH}/attack.js`,
  `${PATH}/escalation.js`,
  `${PATH}/execution.js`,
  `${PATH}/propagation.js`,
  `${PATH}/recon.js`,
];

export {WORKFLOWS_PACKAGE};
