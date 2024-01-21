import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'farmHackExpConfigRequest';

class FarmHackExpConfigRequest extends RequestBase {
  constructor(sender?: string) {
    super(MESSAGE_TYPE, sender);
  }
}

export {FarmHackExpConfigRequest};
