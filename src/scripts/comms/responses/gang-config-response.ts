import {ResponseBase} from '/scripts/comms/response-base';

import {GangManagerConfig} from '/scripts/workflows/gangs';

const MESSAGE_TYPE = 'gangConfigResponse';

class GangConfigResponse extends ResponseBase {
  readonly config?: GangManagerConfig;

  constructor(config?: GangManagerConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {GangConfigResponse};
