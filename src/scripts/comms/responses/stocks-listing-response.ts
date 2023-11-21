import {ResponseBase} from '/scripts/comms/response-base';

import {StockListing} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksListingResponse';

class StockListingsResponse extends ResponseBase {
  readonly stockListings?: StockListing[];

  constructor(stockListings?: StockListing[]) {
    super(MESSAGE_TYPE);

    this.stockListings = stockListings;
  }
}

export {StockListingsResponse};
