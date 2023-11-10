import {MessageBase} from '/scripts/comms/msg-base';

import {PurchaseTransaction} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksPurchasedEvent';

class StocksPurchasedEvent extends MessageBase {
  readonly transactions?: PurchaseTransaction[];

  constructor(transactions?: PurchaseTransaction[]) {
    super(MESSAGE_TYPE);

    this.transactions = transactions;
  }
}

export {StocksPurchasedEvent};
