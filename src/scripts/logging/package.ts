import { SCRIPTS_PATH } from "/scripts/workflows/shared";

const PATH = `${SCRIPTS_PATH}/logging`;
const LOGGING_PACKAGE = [
  `${PATH}/package.js`,
  `${PATH}/loggerManager.js`,
  `${PATH}/logOutput.js`,
  `${PATH}/scriptLogger.js`,
  `${PATH}/terminalLogger.js`,
  `${PATH}/noopLogger.js`,
  `${PATH}/consoleLogger.js`,
];

export {LOGGING_PACKAGE};
