import {ResponseBase} from '/scripts/comms/response-base';
import {HacknetManagerConfig} from '/scripts/workflows/hacknet';

const MESSAGE_TYPE = 'hacknetConfigResponse';

class HacknetConfigResponse extends ResponseBase {
  readonly config?: HacknetManagerConfig;

  constructor(config?: HacknetManagerConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {HacknetConfigResponse};
