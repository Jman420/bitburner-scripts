import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'gangConfigRequest';

class GangConfigRequest extends RequestBase {
  constructor(sender?: string) {
    super(MESSAGE_TYPE, sender);
  }
}

export {GangConfigRequest};
