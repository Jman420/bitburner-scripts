import { SCRIPTS_PATH } from "/scripts/workflows/shared";

const PATH = `${SCRIPTS_PATH}/workflows`;
const WORKFLOWS_PACKAGE = [
  `${PATH}/package.js`,
  `${PATH}/attack.js`,
  `${PATH}/escalation.js`,
  `${PATH}/propagation.js`,
  `${PATH}/recon.js`,
  `${PATH}/shared.js`,
];

export {WORKFLOWS_PACKAGE};
