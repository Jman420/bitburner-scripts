import {MessageBase} from '/scripts/comms/msg-base';

class ResponseBase extends MessageBase {
  constructor(messageType: string) {
    super(messageType);
  }
}

export {ResponseBase};
