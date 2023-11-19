import {MessageBase} from '/scripts/comms/msg-base';

const MESSAGE_TYPE = 'gangsUpdateSettingsEvent';

class GangsUpdateSettingsEvent extends MessageBase {
  readonly purchaseEquipment?: boolean;

  constructor(purchaseEquipment?: boolean) {
    super(MESSAGE_TYPE);

    this.purchaseEquipment = purchaseEquipment;
  }
}

export {GangsUpdateSettingsEvent};
