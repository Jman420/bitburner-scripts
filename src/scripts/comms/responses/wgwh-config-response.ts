import {ResponseBase} from '/scripts/comms/response-base';
import {WgwhAttackConfig} from '/scripts/workflows/attacks';

const MESSAGE_TYPE = 'wgwhConfigResponse';

class WgwhConfigResponse extends ResponseBase {
  readonly config?: WgwhAttackConfig;

  constructor(config?: WgwhAttackConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {WgwhConfigResponse};
