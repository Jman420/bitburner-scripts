import {EventBase} from '/scripts/comms/event-base';

const MESSAGE_TYPE = 'exitEvent';

class ExitEvent extends EventBase {
  readonly scriptName?: string;

  constructor(scriptName?: string) {
    super(MESSAGE_TYPE);

    this.scriptName = scriptName;
  }
}

export {ExitEvent};
