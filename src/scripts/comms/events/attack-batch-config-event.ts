import {EventBase} from '/scripts/comms/event-base';
import {AttackBatchConfig} from '/scripts/workflows/attacks';

const MESSAGE_TYPE = 'attackBatchConfigEvent';

class AttackBatchConfigEvent extends EventBase {
  readonly config?: Partial<AttackBatchConfig>;

  constructor(config?: Partial<AttackBatchConfig>) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {AttackBatchConfigEvent};
