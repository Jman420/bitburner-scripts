import {SCRIPTS_PATH} from '/scripts/common/shared';

const PATH = `${SCRIPTS_PATH}/comms`;
const COMMS_PACKAGE = [
  `${PATH}/package.js`,
  `${PATH}/event-comms.js`,
  `${PATH}/msg-base.js`,
  `${PATH}/messages/exit-event.js`,
  `${PATH}/messages/grow-event.js`,
  `${PATH}/messages/hack-event.js`,
  `${PATH}/messages/weaken-event.js`,
];

export {COMMS_PACKAGE};
