import {EventBase} from '/scripts/comms/event-base';

import {GangManagerConfig} from '/scripts/workflows/gangs';

const MESSAGE_TYPE = 'gangUpdateSettingsEvent';

class GangUpdateSettingsEvent extends EventBase {
  readonly config?: GangManagerConfig;

  constructor(config?: GangManagerConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {GangUpdateSettingsEvent};
