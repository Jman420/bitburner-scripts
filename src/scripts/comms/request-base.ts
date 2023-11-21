import {MessageBase} from '/scripts/comms/msg-base';

abstract class RequestBase extends MessageBase {
  readonly sender?: string;

  constructor(messageType: string, sender?: string) {
    super(messageType);

    this.sender = sender;
  }
}

export {RequestBase};
