import {ResponseBase} from '/scripts/comms/response-base';
import {TeaPartyConfig} from '/scripts/workflows/corporation-shared';

const MESSAGE_TYPE = 'stocksTraderConfigResponse';

class TeaPartyConfigResponse extends ResponseBase {
  readonly config?: TeaPartyConfig;

  constructor(config?: TeaPartyConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {TeaPartyConfigResponse};
