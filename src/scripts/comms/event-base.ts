import {MessageBase} from '/scripts/comms/msg-base';

abstract class EventBase extends MessageBase {
  constructor(messageType: string) {
    super(messageType);
  }
}

export {EventBase};
