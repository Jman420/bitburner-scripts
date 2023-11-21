import {EventBase} from '/scripts/comms/event-base';

import {SaleTransaction} from '/scripts/workflows/stocks';

const MESSAGE_TYPE = 'stocksSoldEvent';

class StocksSoldEvent extends EventBase {
  readonly transactions?: SaleTransaction[];

  constructor(transactions?: SaleTransaction[]) {
    super(MESSAGE_TYPE);

    this.transactions = transactions;
  }
}

export {StocksSoldEvent};
