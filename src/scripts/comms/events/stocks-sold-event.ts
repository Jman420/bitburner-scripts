import {MessageBase} from '/scripts/comms/msg-base';

import {SaleTransaction} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksSoldEvent';

class StocksSoldEvent extends MessageBase {
  readonly transactions?: SaleTransaction[];

  constructor(transactions?: SaleTransaction[]) {
    super(MESSAGE_TYPE);

    this.transactions = transactions;
  }
}

export {StocksSoldEvent};
