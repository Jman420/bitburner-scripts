import {NS, UserInterfaceTheme} from '@ns';

import {getDocument, getReactModel} from '/scripts/workflows/ui';
import {
  GANG_MANAGER_SCRIPT,
  GangManagerConfig,
  TaskFocus,
} from '/scripts/workflows/gangs';
import {getPid, runScript} from '/scripts/workflows/execution';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {GangManagerConfigEvent} from '/scripts/comms/events/gang-manager-config-event';
import {GangConfigResponse} from '/scripts/comms/responses/gang-config-response';
import {GangConfigRequest} from '/scripts/comms/requests/gang-config-request';

import {
  TOGGLE_BUTTON_SELECTED_CLASS,
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
  getLabelStyle,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {ToggleButton} from '/scripts/controls/components/toggle-button';
import {ExclusiveToggleButton} from '/scripts/controls/components/exclusive-toggle-button';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

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
  eventListener: EventListener,
  uiTheme: UserInterfaceTheme
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
    if (uiControl) {
      uiControl.classList.remove(TOGGLE_BUTTON_SELECTED_CLASS);
      uiControl.style.color = uiTheme.secondary;
      uiControl.style.backgroundColor = uiTheme.backgroundprimary;
    }
  }

  const config = responseData.config;
  if (config.buyAugmentations && interfaceControls.buyAugmentations) {
    interfaceControls.buyAugmentations.classList.add(
      TOGGLE_BUTTON_SELECTED_CLASS
    );
    interfaceControls.buyAugmentations.style.color = uiTheme.primary;
    interfaceControls.buyAugmentations.style.backgroundColor = uiTheme.button;
  }
  if (config.buyEquipment && interfaceControls.buyEquipment) {
    interfaceControls.buyEquipment.classList.add(TOGGLE_BUTTON_SELECTED_CLASS);
    interfaceControls.buyEquipment.style.color = uiTheme.primary;
    interfaceControls.buyEquipment.style.backgroundColor = uiTheme.button;
  }

  if (
    config.taskFocus === TaskFocus.RESPECT &&
    interfaceControls.focusRespect
  ) {
    interfaceControls.focusRespect.classList.add(TOGGLE_BUTTON_SELECTED_CLASS);
    interfaceControls.focusRespect.style.color = uiTheme.primary;
    interfaceControls.focusRespect.style.backgroundColor = uiTheme.button;
  } else if (
    config.taskFocus === TaskFocus.MONEY &&
    interfaceControls.focusMoney
  ) {
    interfaceControls.focusMoney.classList.add(TOGGLE_BUTTON_SELECTED_CLASS);
    interfaceControls.focusMoney.style.color = uiTheme.primary;
    interfaceControls.focusMoney.style.backgroundColor = uiTheme.button;
  }
}

function getGangManagerConfig() {
  const interfaceControls = getInterfaceControls();
  const buyAugmentations =
    interfaceControls.buyAugmentations?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CLASS
    ) ?? false;
  const buyEquipment =
    interfaceControls.buyEquipment?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CLASS
    ) ?? false;

  const focusRespect =
    interfaceControls.focusRespect?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CLASS
    ) ?? false;
  const focusMoney =
    interfaceControls.focusMoney?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CLASS
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
  return true;
}

async function handleToggleGangManager(
  netscript: NS,
  eventListener: EventListener,
  uiTheme: UserInterfaceTheme
) {
  let scriptPid = getPid(netscript, GANG_MANAGER_SCRIPT);
  if (!scriptPid) {
    scriptPid = runScript(netscript, GANG_MANAGER_SCRIPT);
    const config = getGangManagerConfig();
    await sendMessageRetry(netscript, new GangManagerConfigEvent(config));

    eventListener.addListener(
      GangConfigResponse,
      handleGangConfigResponse,
      eventListener,
      uiTheme
    );
    sendMessage(new GangConfigRequest(eventListener.subscriberName));
  } else {
    netscript.kill(scriptPid);
    scriptPid = 0;
  }

  return scriptPid !== 0;
}

function GangsManagerUI({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const managerRunning = Boolean(getPid(netscript, GANG_MANAGER_SCRIPT));

  useEffectOnce(() => {
    eventListener.addListener(
      GangConfigResponse,
      handleGangConfigResponse,
      eventListener,
      uiTheme
    );
    sendMessage(new GangConfigRequest(eventListener.subscriberName));
  });

  const divBorderStyle = getDivBorderStyle(uiStyle, uiTheme);
  divBorderStyle.alignItems = 'center';
  divBorderStyle.textAlign = 'center';

  return (
    <div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Gang Manager</label>
        <RunScriptButton
          title="Toggle gang manager script"
          runScriptFunc={handleToggleGangManager.bind(
            undefined,
            netscript,
            eventListener,
            uiTheme
          )}
          scriptAlreadyRunning={managerRunning}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
      </div>
      <label style={getLabelStyle('center')}>Purchase Member Upgrades</label>
      <div style={divBorderStyle}>
        <ToggleButton
          id={BUY_AUGMENTATIONS_BUTTON_ID}
          onClick={sendGangManagerConfig}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Augmentations
        </ToggleButton>
        <ToggleButton
          id={BUY_EQUIPMENT_BUTTON_ID}
          onClick={sendGangManagerConfig}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Equipment
        </ToggleButton>
      </div>
      <label style={getLabelStyle('center')}>Member Task Focus</label>
      <div style={divBorderStyle}>
        <ExclusiveToggleButton
          id={FOCUS_RESPECT_BUTTON_ID}
          exclusiveGroup={MEMBER_FOCUS_GROUP_CLASS}
          onClick={sendGangManagerConfig}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Respect
        </ExclusiveToggleButton>
        <ExclusiveToggleButton
          id={FOCUS_MONEY_BUTTON_ID}
          exclusiveGroup={MEMBER_FOCUS_GROUP_CLASS}
          onClick={sendGangManagerConfig}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Money
        </ExclusiveToggleButton>
      </div>
    </div>
  );
}

export {GangsManagerUI};
