import {EventBase} from '/scripts/comms/event-base';

enum WeakenStatus {
  IN_PROGRESS,
  COMPLETE,
}

const MESSAGE_TYPE = 'weakenEvent';

class WeakenEvent extends EventBase {
  readonly hostname?: string;
  readonly status?: WeakenStatus;

  constructor(hostname?: string, status?: WeakenStatus) {
    super(MESSAGE_TYPE);

    this.hostname = hostname;
    this.status = status;
  }
}

export {WeakenStatus, WeakenEvent};
