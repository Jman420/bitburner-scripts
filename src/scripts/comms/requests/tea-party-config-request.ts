import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'teaPartyConfigRequest';

class TeaPartyConfigRequest extends RequestBase {
  constructor(subscriber?: string) {
    super(MESSAGE_TYPE, subscriber);
  }
}

export {TeaPartyConfigRequest};
