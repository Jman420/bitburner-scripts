import {ResponseBase} from '/scripts/comms/response-base';

import {AttackBatchConfig} from '/scripts/workflows/attacks';

const MESSAGE_TYPE = 'attackBatchConfigResponse';

class AttackBatchConfigResponse extends ResponseBase {
  readonly config?: AttackBatchConfig;

  constructor(config?: AttackBatchConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {AttackBatchConfigResponse};
