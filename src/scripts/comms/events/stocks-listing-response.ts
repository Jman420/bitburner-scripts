import {MessageBase} from '/scripts/comms/msg-base';
import {StockListing} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksListingResponse';

class StockListingsResponse extends MessageBase {
  readonly stockListings?: StockListing[];

  constructor(stockListings?: StockListing[]) {
    super(MESSAGE_TYPE);

    this.stockListings = stockListings;
  }
}

export {StockListingsResponse};
