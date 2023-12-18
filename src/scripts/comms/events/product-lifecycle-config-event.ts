import {EventBase} from '/scripts/comms/event-base';
import {ProductLifecycleConfig} from '/scripts/workflows/corporation';

const MESSAGE_TYPE = 'productLifecycleConfigEvent';

class ProductLifecycleConfigEvent extends EventBase {
  readonly config?: ProductLifecycleConfig;

  constructor(config?: ProductLifecycleConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {ProductLifecycleConfigEvent};
