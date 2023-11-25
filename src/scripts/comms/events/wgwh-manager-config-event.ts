import {EventBase} from '/scripts/comms/event-base';
import {WgwhAttackConfig} from '/scripts/workflows/attacks';

const MESSAGE_TYPE = 'wgwhManagerConfigEvent';

class WgwhManagerConfigEvent extends EventBase {
  readonly config?: WgwhAttackConfig;

  constructor(config?: WgwhAttackConfig) {
    super(MESSAGE_TYPE);
    this.config = config;
  }
}

export {WgwhManagerConfigEvent};
