import {EventBase} from '/scripts/comms/event-base';

import {GangManagerConfig} from '/scripts/workflows/gangs';

const MESSAGE_TYPE = 'gangManagerConfigEvent';

class GangManagerConfigEvent extends EventBase {
  readonly config?: Partial<GangManagerConfig>;

  constructor(config?: Partial<GangManagerConfig>) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {GangManagerConfigEvent};
