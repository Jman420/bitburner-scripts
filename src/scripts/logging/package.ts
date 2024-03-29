import {SCRIPTS_DIR} from '/scripts/common/shared';

const PATH = `${SCRIPTS_DIR}/logging`;
const LOGGING_PACKAGE = [
  `${PATH}/package.js`,
  `${PATH}/consoleLogger.js`,
  `${PATH}/loggerManager.js`,
  `${PATH}/logOutput.js`,
  `${PATH}/noopLogger.js`,
  `${PATH}/scriptLogger.js`,
  `${PATH}/terminalLogger.js`,
];

export {LOGGING_PACKAGE};
