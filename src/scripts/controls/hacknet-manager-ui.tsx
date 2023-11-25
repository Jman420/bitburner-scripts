import {NS} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
  handleDisableTerminal,
  handleEnableTerminal,
  handleTextboxInputChange,
} from '/scripts/workflows/ui';
import {
  HACKNET_MANAGER_SCRIPT,
  HacknetManagerConfig,
} from '/scripts/workflows/hacknet';
import {getPid, runScript} from '/scripts/workflows/execution';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {HacknetConfigRequest} from '/scripts/comms/requests/hacknet-config-request';
import {HacknetConfigResponse} from '/scripts/comms/responses/hacknet-config-response';
import {HacknetManagerConfigEvent} from '/scripts/comms/events/hacknet-manager-config-event';

import {
  BUTTON_CSS_CLASS,
  DIV_BORDER_CSS_CLASS,
  HEADER_DIV_STYLE,
  HEADER_LABEL_STYLE,
  TEXTBOX_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {ToggleButton} from '/scripts/controls/components/toggle-button';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';
import {parseNumber} from '/scripts/workflows/parsing';

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

function getHacknetManagerConfig() {
  const interfaceControls = getInterfaceControls();

  const fundsLimit =
    parseNumber(interfaceControls.fundsLimit?.value ?? '') || -1;
  const config: HacknetManagerConfig = {
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
  return config;
}

function sendHacknetManagerConfig() {
  const config = getHacknetManagerConfig();
  sendMessage(new HacknetManagerConfigEvent(config));
  return true;
}

async function handleToggleHacknetManager(
  netscript: NS,
  eventListener: EventListener,
  setFundsLimit: ReactSetStateFunction<string>
) {
  let scriptPid = getPid(netscript, HACKNET_MANAGER_SCRIPT);
  if (!scriptPid) {
    scriptPid = runScript(netscript, HACKNET_MANAGER_SCRIPT);
    const config = getHacknetManagerConfig();
    await sendMessageRetry(netscript, new HacknetManagerConfigEvent(config));

    eventListener.addListener(
      HacknetConfigResponse,
      handleHacknetConfigResponse,
      netscript,
      eventListener,
      setFundsLimit
    );
    sendMessage(new HacknetConfigRequest(eventListener.subscriberName));
  } else {
    netscript.kill(scriptPid);
    scriptPid = 0;
  }

  return scriptPid !== 0;
}

function HacknetManagerUI({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  const [fundsLimit, setFundsLimit] = useState('');
  const managerRunning = Boolean(getPid(netscript, HACKNET_MANAGER_SCRIPT));

  useEffectOnce(() => {
    eventListener.addListener(
      HacknetConfigResponse,
      handleHacknetConfigResponse,
      netscript,
      eventListener,
      setFundsLimit
    );
    sendMessage(new HacknetConfigRequest(eventListener.subscriberName));
  });

  return (
    <div>
      <div style={HEADER_DIV_STYLE}>
        <label style={HEADER_LABEL_STYLE}>Hacknet Manager</label>
        <RunScriptButton
          title="Toggle hacknet manager script"
          runScriptFunc={handleToggleHacknetManager.bind(
            undefined,
            netscript,
            eventListener,
            setFundsLimit
          )}
          scriptAlreadyRunning={managerRunning}
        />
      </div>
      <label style={LABEL_STYLE}>Purchase Settings</label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <ToggleButton
          id={PURCHASE_NODES_BUTTON_ID}
          onClick={sendHacknetManagerConfig}
        >
          New Nodes
        </ToggleButton>
        <ToggleButton
          id={PURCHASE_UPGRADES_BUTTON_ID}
          onClick={sendHacknetManagerConfig}
        >
          Node Upgrades
        </ToggleButton>
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
          onChange={handleTextboxInputChange.bind(undefined, setFundsLimit)}
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
