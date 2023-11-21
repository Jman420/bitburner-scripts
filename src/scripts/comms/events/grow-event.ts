import {EventBase} from '/scripts/comms/event-base';

enum GrowStatus {
  IN_PROGRESS,
  COMPLETE,
}

const MESSAGE_TYPE = 'growEvent';

class GrowEvent extends EventBase {
  readonly hostname?: string;
  readonly status?: GrowStatus;

  constructor(hostname?: string, status?: GrowStatus) {
    super(MESSAGE_TYPE);

    this.hostname = hostname;
    this.status = status;
  }
}

export {GrowStatus, GrowEvent};
