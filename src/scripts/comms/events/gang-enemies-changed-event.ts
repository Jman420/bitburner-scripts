import {GangOtherInfo} from '@ns';

import {EventBase} from '/scripts/comms/event-base';

const MESSAGE_TYPE = 'gangEnemiesChangedEvent';

class GangEnemiesChangedEvent extends EventBase {
  readonly enemiesInfo?: GangOtherInfo;
  readonly enemyNames?: string[];

  constructor(enemiesInfo?: GangOtherInfo, enemyNames?: string[]) {
    super(MESSAGE_TYPE);

    this.enemiesInfo = enemiesInfo;
    this.enemyNames = enemyNames;
  }
}

export {GangEnemiesChangedEvent};
