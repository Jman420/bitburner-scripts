import {ResponseBase} from '/scripts/comms/response-base';
import {StocksTraderConfig} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksTraderConfigResponse';

class StocksTraderConfigResponse extends ResponseBase {
  readonly config?: StocksTraderConfig;

  constructor(config?: StocksTraderConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {StocksTraderConfigResponse};
