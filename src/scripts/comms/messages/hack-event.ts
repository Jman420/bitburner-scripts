import {MessageBase} from '/scripts/comms/msg-base';

enum HackStatus {
  IN_PROGRESS,
  COMPLETE,
}

const MESSAGE_TYPE = 'hackEvent';

class HackEvent extends MessageBase {
  readonly hostname?: string;
  readonly status?: HackStatus;

  constructor(hostname?: string, status?: HackStatus) {
    super(MESSAGE_TYPE);

    this.hostname = hostname;
    this.status = status;
  }
}

export {HackStatus, HackEvent};
