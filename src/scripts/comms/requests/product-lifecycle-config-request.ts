import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'productLifecycleConfigRequest';

class ProductLifecycleConfigRequest extends RequestBase {
  constructor(sender?: string) {
    super(MESSAGE_TYPE, sender);
  }
}

export {ProductLifecycleConfigRequest};
