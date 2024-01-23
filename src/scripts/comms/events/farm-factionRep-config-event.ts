import {EventBase} from '/scripts/comms/event-base';

import {FactionReputationFarmConfig} from '/scripts/workflows/farms';

const MESSAGE_TYPE = 'farmFactionRepConfigEvent';

class FarmFactionRepConfigEvent extends EventBase {
  readonly config?: Partial<FactionReputationFarmConfig>;

  constructor(config?: Partial<FactionReputationFarmConfig>) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {FarmFactionRepConfigEvent};
