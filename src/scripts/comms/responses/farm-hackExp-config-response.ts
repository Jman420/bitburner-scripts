import {ResponseBase} from '/scripts/comms/response-base';

import {HackExperienceFarmConfig} from '/scripts/workflows/farms';

const MESSAGE_TYPE = 'farmHackExpConfigResponse';

class FarmHackExpConfigResponse extends ResponseBase {
  readonly config?: HackExperienceFarmConfig;

  constructor(config?: HackExperienceFarmConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {FarmHackExpConfigResponse};
