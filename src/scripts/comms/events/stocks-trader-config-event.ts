import {EventBase} from '/scripts/comms/event-base';

import {StocksTraderConfig} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksTraderConfigEvent';

class StocksTraderConfigEvent extends EventBase {
  readonly config?: StocksTraderConfig;

  constructor(config?: StocksTraderConfig) {
    super(MESSAGE_TYPE);

    this.config = config;
  }
}

export {StocksTraderConfigEvent};
