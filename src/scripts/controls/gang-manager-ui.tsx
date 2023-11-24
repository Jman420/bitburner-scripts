import {NS} from '@ns';

import {getDocument, getReactModel} from '/scripts/workflows/ui';
import {
  GANGS_MANAGER_SCRIPT,
  GangManagerConfig,
  TaskFocus,
} from '/scripts/workflows/gangs';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';

import {ensureRunning} from '/scripts/workflows/execution';

import {GangManagerConfigEvent} from '/scripts/comms/events/gang-manager-config-event';
import {GangConfigResponse} from '/scripts/comms/responses/gang-config-response';
import {GangConfigRequest} from '/scripts/comms/requests/gang-config-request';

import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {
  DIV_BORDER_CSS_CLASS,
  HEADER_DIV_STYLE,
  HEADER_LABEL_STYLE,
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
} from '/scripts/controls/style-sheet';

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
    buyAugmentations: doc.getElementById(
      BUY_AUGMENTATIONS_BUTTON_ID
    ) as HTMLButtonElement,
    buyEquipment: doc.getElementById(
      BUY_EQUIPMENT_BUTTON_ID
    ) as HTMLButtonElement,
    focusRespect: doc.getElementById(
      FOCUS_RESPECT_BUTTON_ID
    ) as HTMLButtonElement,
    focusMoney: doc.getElementById(FOCUS_MONEY_BUTTON_ID) as HTMLButtonElement,
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
  for (const propertyKey of Object.keys(interfaceControls) as Array<
    keyof InterfaceControls
  >) {
    const uiControl = interfaceControls[propertyKey];
    uiControl?.classList.remove(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  }

  const config = responseData.config;
  if (config.buyAugmentations) {
    interfaceControls.buyAugmentations?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }
  if (config.buyEquipment) {
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

function getGangManagerConfig() {
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
    buyAugmentations: buyAugmentations,
    buyEquipment: buyEquipment,
    taskFocus: taskFocus,
  };
  return config;
}

function sendGangManagerConfig() {
  const config = getGangManagerConfig();
  sendMessage(new GangManagerConfigEvent(config));
}

async function handleToggleGangManager(netscript: NS, scriptRunning: boolean) {
  if (scriptRunning) {
    netscript.scriptKill(GANGS_MANAGER_SCRIPT, netscript.getHostname());
    return false;
  }

  if (!ensureRunning(netscript, GANGS_MANAGER_SCRIPT)) {
    return false;
  }

  const config = getGangManagerConfig();
  await sendMessageRetry(netscript, new GangManagerConfigEvent(config));
  return true;
}

function GangsManagerUI({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  useEffectOnce(() => {
    eventListener.addListener(
      GangConfigResponse,
      handleGangConfigResponse,
      eventListener
    );
    sendMessageRetry(
      netscript,
      new GangConfigRequest(eventListener.subscriberName)
    );
  });

  return (
    <div>
      <div style={HEADER_DIV_STYLE}>
        <label style={HEADER_LABEL_STYLE}>Gang Manager</label>
        <RunScriptButton
          title="Run gang manager script"
          runScriptFunc={handleToggleGangManager.bind(undefined, netscript)}
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
      <label style={LABEL_STYLE}>Member Task Focus</label>
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
