import {SCRIPTS_PATH} from '/scripts/common/shared';

const PATH = `${SCRIPTS_PATH}/comms`;
const COMMS_PACKAGE = [
  `${PATH}/package.js`,
  `${PATH}/event-comms.js`,
  `${PATH}/msg-base.js`,
  `${PATH}/events/exit-event.js`,
  `${PATH}/events/grow-event.js`,
  `${PATH}/events/hack-event.js`,
  `${PATH}/events/stocks-listing-request.js`,
  `${PATH}/events/stocks-listing-response.js`,
  `${PATH}/events/stocks-purchased-event.js`,
  `${PATH}/events/stocks-sold-event.js`,
  `${PATH}/events/stocks-ticker-event.js`,
  `${PATH}/events/weaken-event.js`,
];

export {COMMS_PACKAGE};
