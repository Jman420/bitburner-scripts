import {EventBase} from '/scripts/comms/event-base';

import {HacknetManagerConfig} from '/scripts/workflows/hacknet';

const MESSAGE_TYPE = 'hacknetManagerConfigEvent';

class HacknetManagerConfigEvent extends EventBase {
  readonly config?: HacknetManagerConfig;

  constructor(config?: HacknetManagerConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {HacknetManagerConfigEvent};
