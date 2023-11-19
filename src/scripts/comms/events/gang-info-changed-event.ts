import {GangGenInfo} from '@ns';

import {MessageBase} from '/scripts/comms/msg-base';
import {MemberDetails} from '/scripts/workflows/gangs';

const MESSAGE_TYPE = 'gangInfoChangedEvent';

class GangInfoChangedEvent extends MessageBase {
  readonly gangInfo?: GangGenInfo;
  readonly gangMembers?: MemberDetails[];

  constructor(gangInfo?: GangGenInfo, gangMembers?: MemberDetails[]) {
    super(MESSAGE_TYPE);

    this.gangInfo = gangInfo;
    this.gangMembers = gangMembers;
  }
}

export {GangInfoChangedEvent};
