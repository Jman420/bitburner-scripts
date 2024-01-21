import {EventBase} from '/scripts/comms/event-base';
import {WgwhAttackConfig} from '/scripts/workflows/attacks';

const MESSAGE_TYPE = 'wgwhManagerConfigEvent';

class WgwhManagerConfigEvent extends EventBase {
  readonly config?: Partial<WgwhAttackConfig>;

  constructor(config?: Partial<WgwhAttackConfig>) {
    super(MESSAGE_TYPE);
    this.config = config;
  }
}

export {WgwhManagerConfigEvent};
