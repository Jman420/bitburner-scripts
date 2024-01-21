import {EventBase} from '/scripts/comms/event-base';

import {HackExperienceFarmConfig} from '/scripts/workflows/farms';

const MESSAGE_TYPE = 'farmHackExpConfigEvent';

class FarmHackExpConfigEvent extends EventBase {
  readonly config?: Partial<HackExperienceFarmConfig>;

  constructor(config?: Partial<HackExperienceFarmConfig>) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {FarmHackExpConfigEvent};
