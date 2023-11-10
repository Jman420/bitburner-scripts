import {MessageBase} from '/scripts/comms/msg-base';

const MESSAGE_TYPE = 'stocksListingRequest';

class StockListingsRequest extends MessageBase {
  readonly subscriber?: string;
  readonly symbols?: string[];

  constructor(subscriber?: string, symbols?: string[]) {
    super(MESSAGE_TYPE);

    this.subscriber = subscriber;
    this.symbols = symbols;
  }
}

export {StockListingsRequest};
