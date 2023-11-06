import {MessageBase} from '/scripts/comms/msg-base';

const MESSAGE_TYPE = 'exitEvent';

class ExitEvent extends MessageBase {
  readonly scriptName?: string;

  constructor(scriptName?: string) {
    super(MESSAGE_TYPE);
    this.scriptName = scriptName;
  }
}

export {ExitEvent};
