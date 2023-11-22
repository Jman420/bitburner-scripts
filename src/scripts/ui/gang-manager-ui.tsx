import {UserInterfaceTheme} from '@ns';

import {
  DIV_BORDER_CSS_CLASS,
  PLAY_ICON_SVG_PATH,
  SVG_BUTTON_CSS_CLASS,
  SVG_PLAY_ICON_CSS_CLASS,
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
  getDocument,
  getReactModel,
} from '/scripts/workflows/ui';
import {GangManagerConfig, TaskFocus} from '/scripts/workflows/gangs';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {GangManagerConfigEvent} from '/scripts/comms/events/gang-manager-config-event';
import {useEffectOnce} from '/scripts/ui/hooks/use-effect-once';
import {GangConfigResponse} from '/scripts/comms/responses/gang-config-response';
import {GangConfigRequest} from '/scripts/comms/requests/gang-config-request';
import {
  RunScriptButton,
  RunScriptFunction,
} from '/scripts/ui/components/run-script-button';
import {MouseEventHandler} from 'react';

interface InterfaceControls {
  buyAugmentations: HTMLElement | null;
  buyEquipment: HTMLElement | null;
  focusRespect: HTMLElement | null;
  focusMoney: HTMLElement | null;
}

const React = getReactModel().reactNS;

const BUY_AUGMENTATIONS_BUTTON_ID = 'buyAugmentations';
const BUY_EQUIPMENT_BUTTON_ID = 'buyEquipment';
const FOCUS_RESPECT_BUTTON_ID = 'focusRespect';
const FOCUS_MONEY_BUTTON_ID = 'focusMoney';

const MEMBER_FOCUS_GROUP_CLASS = 'memberFocus';

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '14pt',
  textAlign: 'center',
  display: 'block',
};
const DIV_STYLE: React.CSSProperties = {
  alignItems: 'center',
  textAlign: 'center',
};

function getInterfaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    buyAugmentations: doc.getElementById(BUY_AUGMENTATIONS_BUTTON_ID),
    buyEquipment: doc.getElementById(BUY_EQUIPMENT_BUTTON_ID),
    focusRespect: doc.getElementById(FOCUS_RESPECT_BUTTON_ID),
    focusMoney: doc.getElementById(FOCUS_MONEY_BUTTON_ID),
  };
  return result;
}

function handleGangConfigResponse(
  responseData: GangConfigResponse,
  eventListener: EventListener
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(GangConfigResponse, handleGangConfigResponse);

  const interfaceControls = getInterfaceControls();
  interfaceControls.buyAugmentations?.classList.remove(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );
  interfaceControls.buyEquipment?.classList.remove(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );
  interfaceControls.focusRespect?.classList.remove(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );
  interfaceControls.focusMoney?.classList.remove(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );

  const config = responseData.config;
  if (config.purchaseAugmentations) {
    interfaceControls.buyAugmentations?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }
  if (config.purchaseEquipment) {
    interfaceControls.buyEquipment?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }

  if (config.taskFocus === TaskFocus.RESPECT) {
    interfaceControls.focusRespect?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  } else if (config.taskFocus === TaskFocus.MONEY) {
    interfaceControls.focusMoney?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }
}

function handlePurchaseUpgradesClick(
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  const targetClassList = eventData.currentTarget.classList;
  if (targetClassList.contains(TOGGLE_BUTTON_SELECTED_CSS_CLASS)) {
    targetClassList.remove(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  } else {
    targetClassList.add(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  }

  sendGangManagerConfig();
}

function handleMembersFocusClick(
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  const targetClassList = eventData.currentTarget.classList;
  if (targetClassList.contains(TOGGLE_BUTTON_SELECTED_CSS_CLASS)) {
    return;
  }

  const doc = getDocument();
  const groupElements = doc.getElementsByClassName(MEMBER_FOCUS_GROUP_CLASS);
  for (const exclusiveElement of groupElements) {
    exclusiveElement.classList.remove(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  }
  targetClassList.add(TOGGLE_BUTTON_SELECTED_CSS_CLASS);

  sendGangManagerConfig();
}

function sendGangManagerConfig() {
  const interfaceControls = getInterfaceControls();
  const buyAugmentations =
    interfaceControls.buyAugmentations?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    ) ?? false;
  const buyEquipment =
    interfaceControls.buyEquipment?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    ) ?? false;
  const focusRespect =
    interfaceControls.focusRespect?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    ) ?? false;
  const focusMoney =
    interfaceControls.focusMoney?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    ) ?? false;
  let taskFocus = TaskFocus.MONEY;
  if (focusRespect) {
    taskFocus = TaskFocus.RESPECT;
  } else if (focusMoney) {
    taskFocus = TaskFocus.MONEY;
  }

  const config: GangManagerConfig = {
    purchaseAugmentations: buyAugmentations,
    purchaseEquipment: buyEquipment,
    taskFocus: taskFocus,
  };
  sendMessage(new GangManagerConfigEvent(config));
}

function GangsManagerUI({
  uiTheme,
  eventListener,
  runManagerCallback,
}: {
  uiTheme: UserInterfaceTheme;
  eventListener: EventListener;
  runManagerCallback: RunScriptFunction;
}) {
  useEffectOnce(() => {
    eventListener.addListener(
      GangConfigResponse,
      handleGangConfigResponse,
      eventListener
    );
    sendMessage(new GangConfigRequest(eventListener.subscriberName));
  });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <label style={{textAlign: 'center', fontSize: '14pt', margin: 'auto'}}>
          Gang Manager Controls
        </label>
        <RunScriptButton
          title="Run gang manager script"
          runScriptFunc={runManagerCallback}
        />
      </div>
      <label style={LABEL_STYLE}>Purchase Member Upgrades</label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <button
          id={BUY_AUGMENTATIONS_BUTTON_ID}
          className={TOGGLE_BUTTON_CSS_CLASS}
          onClick={handlePurchaseUpgradesClick}
        >
          Augmentations
        </button>
        <button
          id={BUY_EQUIPMENT_BUTTON_ID}
          className={TOGGLE_BUTTON_CSS_CLASS}
          onClick={handlePurchaseUpgradesClick}
        >
          Equipment
        </button>
      </div>
      <label color={uiTheme.info} style={LABEL_STYLE}>
        Member Task Focus
      </label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <button
          id={FOCUS_RESPECT_BUTTON_ID}
          className={`${TOGGLE_BUTTON_CSS_CLASS} ${MEMBER_FOCUS_GROUP_CLASS}`}
          onClick={handleMembersFocusClick}
        >
          Respect
        </button>
        <button
          id={FOCUS_MONEY_BUTTON_ID}
          className={`${TOGGLE_BUTTON_CSS_CLASS} ${MEMBER_FOCUS_GROUP_CLASS}`}
          onClick={handleMembersFocusClick}
        >
          Money
        </button>
      </div>
    </div>
  );
}

export {GangsManagerUI};
