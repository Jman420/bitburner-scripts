import {NS} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
  handleDisableTerminal,
  handleEnableTerminal,
  handleNumericInputChange,
} from '/scripts/workflows/ui';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {HacknetConfigRequest} from '/scripts/comms/requests/hacknet-config-request';
import {HacknetConfigResponse} from '/scripts/comms/responses/hacknet-config-response';
import {HacknetManagerConfigEvent} from '/scripts/comms/events/hacknet-manager-config-event';

import {
  HACKNET_MANAGER_SCRIPT,
  HacknetManagerConfig,
} from '/scripts/workflows/hacknet';
import {RunScriptButton} from '/scripts/ui/components/run-script-button';
import {ensureRunning} from '/scripts/workflows/execution';

import {
  BUTTON_CSS_CLASS,
  DIV_BORDER_CSS_CLASS,
  HEADER_DIV_STYLE,
  HEADER_LABEL_STYLE,
  TEXTBOX_CSS_CLASS,
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
} from '/scripts/ui/style-sheet';
import {useEffectOnce} from '/scripts/ui/hooks/use-effect-once';

const React = getReactModel().reactNS;
const useState = React.useState;

interface InterfaceControls {
  purchaseNodes: HTMLButtonElement | undefined;
  purchaseUpgrades: HTMLButtonElement | undefined;
  fundsLimit: HTMLInputElement | undefined;
}

const DIV_STYLE: React.CSSProperties = {
  alignItems: 'center',
  textAlign: 'center',
};
const LABEL_STYLE: React.CSSProperties = {
  fontSize: '14pt',
  textAlign: 'center',
  display: 'block',
};
const INPUT_STYLE: React.CSSProperties = {
  fontSize: '14pt',
  textAlign: 'center',
  display: 'block',
};

const PURCHASE_NODES_BUTTON_ID = 'purchaseNodes';
const PURCHASE_UPGRADES_BUTTON_ID = 'purchaseUpgrades';
const FUNDS_LIMIT_INPUT_ID = 'fundsLimit';
const SET_FUNDS_LIMIT_BUTTON_ID = 'setFundsLimit';

function getInterfaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    purchaseNodes: (doc.getElementById(PURCHASE_NODES_BUTTON_ID) ??
      undefined) as HTMLButtonElement | undefined,
    purchaseUpgrades: (doc.getElementById(PURCHASE_UPGRADES_BUTTON_ID) ??
      undefined) as HTMLButtonElement | undefined,
    fundsLimit: (doc.getElementById(FUNDS_LIMIT_INPUT_ID) ?? undefined) as
      | HTMLInputElement
      | undefined,
  };
  return result;
}

function handleHacknetConfigResponse(
  responseData: HacknetConfigResponse,
  netscript: NS,
  eventListener: EventListener,
  setFundsLimit: ReactSetStateFunction<string>
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(
    HacknetConfigResponse,
    handleHacknetConfigResponse
  );

  const interfaceControls = getInterfaceControls();
  interfaceControls.purchaseNodes?.classList.remove(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );
  interfaceControls.purchaseUpgrades?.classList.remove(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );

  const config = responseData.config;
  if (config.purchaseNodes) {
    interfaceControls.purchaseNodes?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }
  if (config.purchaseUpgrades) {
    interfaceControls.purchaseUpgrades?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }
  setFundsLimit(netscript.formatNumber(config.fundsLimit));
}

function handlePurchaseSettingsClick(
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  const targetClassList = eventData.currentTarget.classList;
  if (targetClassList.contains(TOGGLE_BUTTON_SELECTED_CSS_CLASS)) {
    targetClassList.remove(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  } else {
    targetClassList.add(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  }

  sendHacknetManagerConfig();
}

function handleSetFundsLimitClick(
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  const interfaceControls = getInterfaceControls();
  const fundsLimitValue = interfaceControls.fundsLimit?.value.replaceAll(
    ',',
    ''
  );
  if (!fundsLimitValue || isNaN(parseInt(fundsLimitValue))) {
    return;
  }

  sendHacknetManagerConfig();
}

function sendHacknetManagerConfig() {
  const interfaceControls = getInterfaceControls();

  let fundsLimit = parseInt(
    interfaceControls.fundsLimit?.value.replaceAll(',', '') ?? ''
  );
  if (isNaN(fundsLimit)) {
    fundsLimit = 0;
  }

  const managerConfig: HacknetManagerConfig = {
    purchaseNodes:
      interfaceControls.purchaseNodes?.classList.contains(
        TOGGLE_BUTTON_SELECTED_CSS_CLASS
      ) ?? false,
    purchaseUpgrades:
      interfaceControls.purchaseUpgrades?.classList.contains(
        TOGGLE_BUTTON_SELECTED_CSS_CLASS
      ) ?? false,
    fundsLimit: fundsLimit,
  };
  sendMessage(new HacknetManagerConfigEvent(managerConfig));
}

async function handleToggleHacknetManager(
  netscript: NS,
  eventListener: EventListener,
  setFundsLimit: ReactSetStateFunction<string>,
  scriptRunning: boolean
) {
  if (scriptRunning) {
    netscript.scriptKill(HACKNET_MANAGER_SCRIPT, netscript.getHostname());
    return false;
  }

  if (!ensureRunning(netscript, HACKNET_MANAGER_SCRIPT)) {
    return false;
  }

  eventListener.addListener(
    HacknetConfigResponse,
    handleHacknetConfigResponse,
    netscript,
    eventListener,
    setFundsLimit
  );
  await sendMessageRetry(
    netscript,
    new HacknetConfigRequest(eventListener.subscriberName)
  );
  return true;
}

function HacknetManagerUI({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  const [fundsLimit, setFundsLimit] = useState('');

  useEffectOnce(() => {
    eventListener.addListener(
      HacknetConfigResponse,
      handleHacknetConfigResponse,
      netscript,
      eventListener,
      setFundsLimit
    );
    sendMessageRetry(
      netscript,
      new HacknetConfigRequest(eventListener.subscriberName)
    );
  });

  return (
    <div>
      <div style={HEADER_DIV_STYLE}>
        <label style={HEADER_LABEL_STYLE}>Hacknet Manager</label>
        <RunScriptButton
          title="Run hacknet manager script"
          runScriptFunc={handleToggleHacknetManager.bind(
            undefined,
            netscript,
            eventListener,
            setFundsLimit
          )}
        />
      </div>
      <label style={LABEL_STYLE}>Purchase Settings</label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <button
          id={PURCHASE_NODES_BUTTON_ID}
          className={TOGGLE_BUTTON_CSS_CLASS}
          onClick={handlePurchaseSettingsClick}
        >
          New Nodes
        </button>
        <button
          id={PURCHASE_UPGRADES_BUTTON_ID}
          className={TOGGLE_BUTTON_CSS_CLASS}
          onClick={handlePurchaseSettingsClick}
        >
          Node Upgrades
        </button>
      </div>
      <div style={DIV_STYLE}>
        <input
          id={FUNDS_LIMIT_INPUT_ID}
          className={TEXTBOX_CSS_CLASS}
          style={INPUT_STYLE}
          placeholder="Enter funds limit"
          value={fundsLimit}
          onFocusCapture={handleDisableTerminal}
          onBlur={handleEnableTerminal}
          onChange={handleNumericInputChange.bind(undefined, setFundsLimit)}
        />
        <button
          id={SET_FUNDS_LIMIT_BUTTON_ID}
          className={BUTTON_CSS_CLASS}
          onClick={handleSetFundsLimitClick}
        >
          Set Funds Limit
        </button>
      </div>
    </div>
  );
}

export {HacknetManagerUI};
