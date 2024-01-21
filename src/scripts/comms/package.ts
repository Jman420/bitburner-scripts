import {SCRIPTS_DIR} from '/scripts/common/shared';

const PATH = `${SCRIPTS_DIR}/comms`;
const COMMS_PACKAGE = [
  `${PATH}/package.js`,
  `${PATH}/event-base.js`,
  `${PATH}/event-comms.js`,
  `${PATH}/msg-base.js`,
  `${PATH}/events/exit-event.js`,
];

export {COMMS_PACKAGE};
