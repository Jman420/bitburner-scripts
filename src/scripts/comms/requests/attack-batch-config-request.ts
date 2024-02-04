import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'attackBatchConfigRequest';

class AttackBatchConfigRequest extends RequestBase {
  constructor(sender?: string) {
    super(MESSAGE_TYPE, sender);
  }
}

export {AttackBatchConfigRequest};
