import { EventBase } from '/scripts/comms/event-base';

const MESSAGE_TYPE = 'templateEvent';

class TemplateEvent extends EventBase {
  constructor() {
    super(MESSAGE_TYPE);
  }
}

export {TemplateEvent};
