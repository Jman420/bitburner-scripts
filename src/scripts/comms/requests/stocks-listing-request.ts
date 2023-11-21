import {RequestBase} from '/scripts/comms/request-base';

const MESSAGE_TYPE = 'stocksListingRequest';

class StockListingsRequest extends RequestBase {
  readonly symbols?: string[];

  constructor(sender?: string, symbols?: string[]) {
    super(MESSAGE_TYPE, sender);

    this.symbols = symbols;
  }
}

export {StockListingsRequest};
