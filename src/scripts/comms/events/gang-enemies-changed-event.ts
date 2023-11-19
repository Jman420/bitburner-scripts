import {GangOtherInfo} from '@ns';

import {MessageBase} from '/scripts/comms/msg-base';

const MESSAGE_TYPE = 'gangEnemiesChangedEvent';

class GangEnemiesChangedEvent extends MessageBase {
  readonly enemiesInfo?: GangOtherInfo;
  readonly enemyNames?: string[];

  constructor(enemiesInfo?: GangOtherInfo, enemyNames?: string[]) {
    super(MESSAGE_TYPE);

    this.enemiesInfo = enemiesInfo;
    this.enemyNames = enemyNames;
  }
}

export {GangEnemiesChangedEvent};
