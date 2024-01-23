import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'farmFactionRepConfigRequest';

class FarmFactionRepConfigRequest extends RequestBase {
  constructor(sender?: string) {
    super(MESSAGE_TYPE, sender);
  }
}

export {FarmFactionRepConfigRequest};
