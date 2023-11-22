import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'stocksTraderConfigRequest';

class StocksTraderConfigRequest extends RequestBase {
  constructor(subscriber?: string) {
    super(MESSAGE_TYPE, subscriber);
  }
}

export {StocksTraderConfigRequest};
