import {NS} from '@ns';

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
  DIV_BORDER_CSS_CLASS,
  HEADER_DIV_STYLE,
  HEADER_LABEL_STYLE,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
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
  return true;
}

async function handleToggleGangManager(
  netscript: NS,
  eventListener: EventListener
) {
  let scriptPid = getPid(netscript, GANG_MANAGER_SCRIPT);
  if (!scriptPid) {
    scriptPid = runScript(netscript, GANG_MANAGER_SCRIPT);
    const config = getGangManagerConfig();
    await sendMessageRetry(netscript, new GangManagerConfigEvent(config));

    eventListener.addListener(
      GangConfigResponse,
      handleGangConfigResponse,
      eventListener
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
  const managerRunning = Boolean(getPid(netscript, GANG_MANAGER_SCRIPT));

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
      <div style={HEADER_DIV_STYLE}>
        <label style={HEADER_LABEL_STYLE}>Gang Manager</label>
        <RunScriptButton
          title="Toggle gang manager script"
          runScriptFunc={handleToggleGangManager.bind(
            undefined,
            netscript,
            eventListener
          )}
          scriptAlreadyRunning={managerRunning}
        />
      </div>
      <label style={LABEL_STYLE}>Purchase Member Upgrades</label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <ToggleButton
          id={BUY_AUGMENTATIONS_BUTTON_ID}
          onClick={sendGangManagerConfig}
        >
          Augmentations
        </ToggleButton>
        <ToggleButton
          id={BUY_EQUIPMENT_BUTTON_ID}
          onClick={sendGangManagerConfig}
        >
          Equipment
        </ToggleButton>
      </div>
      <label style={LABEL_STYLE}>Member Task Focus</label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <ExclusiveToggleButton
          id={FOCUS_RESPECT_BUTTON_ID}
          exclusiveGroup={MEMBER_FOCUS_GROUP_CLASS}
          onClick={sendGangManagerConfig}
        >
          Respect
        </ExclusiveToggleButton>
        <ExclusiveToggleButton
          id={FOCUS_MONEY_BUTTON_ID}
          exclusiveGroup={MEMBER_FOCUS_GROUP_CLASS}
          onClick={sendGangManagerConfig}
        >
          Money
        </ExclusiveToggleButton>
      </div>
    </div>
  );
}

export {GangsManagerUI};
