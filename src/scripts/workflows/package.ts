import {SCRIPTS_PATH} from '/scripts/common/shared';
import {COMMON_PACKAGE} from '/scripts/common/package';
import {LOGGING_PACKAGE} from '/scripts/logging/package';
import {COMMS_PACKAGE} from '/scripts/comms/package';

const PATH = `${SCRIPTS_PATH}/workflows`;
const WORKFLOWS_PACKAGE = COMMON_PACKAGE.concat(
  LOGGING_PACKAGE.concat(
    COMMS_PACKAGE.concat([
      `${PATH}/package.js`,
      `${PATH}/cmd-args.js`,
      `${PATH}/escalation.js`,
      `${PATH}/execution.js`,
      `${PATH}/orchestration.js`,
      `${PATH}/propagation.js`,
      `${PATH}/recon.js`,
    ])
  )
);

export {WORKFLOWS_PACKAGE};
