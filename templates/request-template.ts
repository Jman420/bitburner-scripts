import { RequestBase } from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'templateRequest';

class TemplateRequest extends RequestBase {
  constructor(subscriber?: string) {
    super(MESSAGE_TYPE, subscriber);
  }
}

export {TemplateRequest};
