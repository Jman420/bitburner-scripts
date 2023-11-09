import {MessageBase} from '/scripts/comms/msg-base';

const MESSAGE_TYPE = 'stocksUpdatedEvent';

class StocksUpdatedEvent extends MessageBase {
  readonly updatedStockSymbols?: string[];

  constructor(updatedStockSymbols?: string[]) {
    super(MESSAGE_TYPE);

    this.updatedStockSymbols = updatedStockSymbols;
  }
}

export {StocksUpdatedEvent};
