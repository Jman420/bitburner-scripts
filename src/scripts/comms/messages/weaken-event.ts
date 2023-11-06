import {MessageBase} from '/scripts/comms/msg-base';

enum WeakenStatus {
  IN_PROGRESS,
  COMPLETE,
}

const MESSAGE_TYPE = 'weakenEvent';

class WeakenEvent extends MessageBase {
  readonly hostname?: string;
  readonly status?: WeakenStatus;

  constructor(hostname?: string, status?: WeakenStatus) {
    super(MESSAGE_TYPE);

    this.hostname = hostname;
    this.status = status;
  }
}

export {WeakenStatus, WeakenEvent};
