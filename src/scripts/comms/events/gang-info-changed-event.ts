import {GangGenInfo} from '@ns';

import {EventBase} from '/scripts/comms/event-base';

import {MemberDetails} from '/scripts/workflows/gangs';

const MESSAGE_TYPE = 'gangInfoChangedEvent';

class GangInfoChangedEvent extends EventBase {
  readonly gangInfo?: GangGenInfo;
  readonly gangMembers?: MemberDetails[];

  constructor(gangInfo?: GangGenInfo, gangMembers?: MemberDetails[]) {
    super(MESSAGE_TYPE);

    this.gangInfo = gangInfo;
    this.gangMembers = gangMembers;
  }
}

export {GangInfoChangedEvent};
