import {ResponseBase} from '/scripts/comms/response-base';

import {FactionReputationFarmConfig} from '/scripts/workflows/farms';

const MESSAGE_TYPE = 'farmFactionRepConfigResponse';

class FarmFactionRepConfigResponse extends ResponseBase {
  readonly config?: FactionReputationFarmConfig;

  constructor(config?: FactionReputationFarmConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {FarmFactionRepConfigResponse};
