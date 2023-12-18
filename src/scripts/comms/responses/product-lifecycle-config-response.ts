import {ResponseBase} from '/scripts/comms/response-base';
import {ProductLifecycleConfig} from '/scripts/workflows/corporation';

const MESSAGE_TYPE = 'productLifecycleConfigResponse';

class ProductLifecycleConfigResponse extends ResponseBase {
  readonly config?: ProductLifecycleConfig;

  constructor(config?: ProductLifecycleConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {ProductLifecycleConfigResponse};
