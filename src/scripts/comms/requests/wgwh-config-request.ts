import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'wgwhConfigRequest';

class WgwhConfigRequest extends RequestBase {
  constructor(subscriber?: string) {
    super(MESSAGE_TYPE, subscriber);
  }
}

export {WgwhConfigRequest};
