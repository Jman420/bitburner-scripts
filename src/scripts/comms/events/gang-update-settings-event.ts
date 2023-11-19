import {MessageBase} from '/scripts/comms/msg-base';
import {TaskFocus} from '/scripts/workflows/gangs';

const MESSAGE_TYPE = 'gangUpdateSettingsEvent';

class GangUpdateSettingsEvent extends MessageBase {
  readonly purchaseAugmentations?: boolean;
  readonly purchaseEquipment?: boolean;
  readonly taskFocus?: TaskFocus;

  constructor(
    purachaseAugmentations?: boolean,
    purchaseEquipment?: boolean,
    taskFocus?: TaskFocus
  ) {
    super(MESSAGE_TYPE);

    this.purchaseAugmentations = purachaseAugmentations;
    this.purchaseEquipment = purchaseEquipment;
    this.taskFocus = taskFocus;
  }
}

export {GangUpdateSettingsEvent};
