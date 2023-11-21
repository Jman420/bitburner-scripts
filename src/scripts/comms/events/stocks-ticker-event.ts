import {EventBase} from '/scripts/comms/event-base';

import {StockListing} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksTickerEvent';

class StocksTickerEvent extends EventBase {
  readonly stockListings?: StockListing[];

  constructor(stockListings?: StockListing[]) {
    super(MESSAGE_TYPE);

    this.stockListings = stockListings;
  }
}

export {StocksTickerEvent};
