import {EventBase} from '/scripts/comms/event-base';

import {PurchaseTransaction} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksPurchasedEvent';

class StocksPurchasedEvent extends EventBase {
  readonly transactions?: PurchaseTransaction[];

  constructor(transactions?: PurchaseTransaction[]) {
    super(MESSAGE_TYPE);

    this.transactions = transactions;
  }
}

export {StocksPurchasedEvent};
