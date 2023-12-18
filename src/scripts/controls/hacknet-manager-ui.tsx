import {NS, UserInterfaceTheme} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
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
  TOGGLE_BUTTON_SELECTED_CLASS,
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
  getLabelStyle,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {ToggleButton} from '/scripts/controls/components/toggle-button';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';
import {parseNumber} from '/scripts/workflows/parsing';
import {Button} from '/scripts/controls/components/button';
import {Input} from '/scripts/controls/components/input';

const React = getReactModel().reactNS;
const useState = React.useState;

interface InterfaceControls {
  purchaseNodes: HTMLButtonElement | undefined;
  purchaseUpgrades: HTMLButtonElement | undefined;
  fundsLimit: HTMLInputElement | undefined;
}

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
  setFundsLimit: ReactSetStateFunction<string>,
  uiTheme: UserInterfaceTheme
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(
    HacknetConfigResponse,
    handleHacknetConfigResponse
  );

  const config = responseData.config;
  const interfaceControls = getInterfaceControls();
  if (interfaceControls.purchaseNodes) {
    interfaceControls.purchaseNodes.classList.remove(
      TOGGLE_BUTTON_SELECTED_CLASS
    );
    interfaceControls.purchaseNodes.style.color = uiTheme.secondary;
    interfaceControls.purchaseNodes.style.backgroundColor =
      uiTheme.backgroundprimary;

    if (config.purchaseNodes) {
      interfaceControls.purchaseNodes.classList.add(
        TOGGLE_BUTTON_SELECTED_CLASS
      );
      interfaceControls.purchaseNodes.style.color = uiTheme.primary;
      interfaceControls.purchaseNodes.style.backgroundColor = uiTheme.button;
    }
  }
  if (interfaceControls.purchaseUpgrades) {
    interfaceControls.purchaseUpgrades.classList.remove(
      TOGGLE_BUTTON_SELECTED_CLASS
    );
    interfaceControls.purchaseUpgrades.style.color = uiTheme.secondary;
    interfaceControls.purchaseUpgrades.style.backgroundColor =
      uiTheme.backgroundprimary;

    if (config.purchaseUpgrades) {
      interfaceControls.purchaseUpgrades.classList.add(
        TOGGLE_BUTTON_SELECTED_CLASS
      );
      interfaceControls.purchaseUpgrades.style.color = uiTheme.primary;
      interfaceControls.purchaseUpgrades.style.backgroundColor = uiTheme.button;
    }
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
  const config: HacknetManagerConfig = {
    purchaseNodes:
      interfaceControls.purchaseNodes?.classList.contains(
        TOGGLE_BUTTON_SELECTED_CLASS
      ) ?? false,
    purchaseUpgrades:
      interfaceControls.purchaseUpgrades?.classList.contains(
        TOGGLE_BUTTON_SELECTED_CLASS
      ) ?? false,
    fundsLimit: parseNumber(interfaceControls.fundsLimit?.value ?? '') || -1,
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
  setFundsLimit: ReactSetStateFunction<string>,
  uiTheme: UserInterfaceTheme
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
      setFundsLimit,
      uiTheme
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
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const [fundsLimit, setFundsLimit] = useState('');
  const targetRunning = Boolean(getPid(netscript, HACKNET_MANAGER_SCRIPT));

  useEffectOnce(() => {
    eventListener.addListener(
      HacknetConfigResponse,
      handleHacknetConfigResponse,
      netscript,
      eventListener,
      setFundsLimit,
      uiTheme
    );
    sendMessage(new HacknetConfigRequest(eventListener.subscriberName));
  });

  return (
    <div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Hacknet Manager</label>
        <RunScriptButton
          title="Toggle hacknet manager script"
          runScriptFunc={handleToggleHacknetManager.bind(
            undefined,
            netscript,
            eventListener,
            setFundsLimit,
            uiTheme
          )}
          scriptAlreadyRunning={targetRunning}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
      </div>
      <label style={getLabelStyle('center')}>Purchase Settings</label>
      <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
        <ToggleButton
          id={PURCHASE_NODES_BUTTON_ID}
          onClick={sendHacknetManagerConfig}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          New Nodes
        </ToggleButton>
        <ToggleButton
          id={PURCHASE_UPGRADES_BUTTON_ID}
          onClick={sendHacknetManagerConfig}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Node Upgrades
        </ToggleButton>
      </div>
      <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
        <Input
          id={FUNDS_LIMIT_INPUT_ID}
          placeholder="Enter funds limit"
          value={fundsLimit}
          setValue={setFundsLimit}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
          textAlign="center"
        />
        <Button
          id={SET_FUNDS_LIMIT_BUTTON_ID}
          onClick={handleSetFundsLimitClick}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Set Funds Limit
        </Button>
      </div>
    </div>
  );
}

export {HacknetManagerUI};
