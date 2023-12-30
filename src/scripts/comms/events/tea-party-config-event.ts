import {EventBase} from '/scripts/comms/event-base';
import {TeaPartyConfig} from '/scripts/workflows/corporation-shared';

const MESSAGE_TYPE = 'corpTeaPartyConfigEvent';

class TeaPartyConfigEvent extends EventBase {
  readonly config?: TeaPartyConfig;

  constructor(config?: TeaPartyConfig) {
    super(MESSAGE_TYPE);
    this.config = config;
  }
}

export {TeaPartyConfigEvent};
