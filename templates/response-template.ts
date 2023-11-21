import { ResponseBase } from '/scripts/comms/response-base';

const MESSAGE_TYPE = 'templateResponse';

class TemplateResponse extends ResponseBase {
  constructor() {
    super(MESSAGE_TYPE);
  }
}

export {TemplateResponse};
