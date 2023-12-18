import {NS} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
} from '/scripts/workflows/ui';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {TeaPartyConfigEvent} from '/scripts/comms/events/tea-party-config-event';
import {TeaPartyConfigRequest} from '/scripts/comms/requests/tea-party-config-request';
import {TeaPartyConfigResponse} from '/scripts/comms/responses/tea-party-config-response';

import {
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {LabeledInput} from '/scripts/controls/components/labeled-input';
import {Button} from '/scripts/controls/components/button';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

import {parseNumber} from '/scripts/workflows/parsing';
import {TEA_PARTY_SCRIPT, TeaPartyConfig} from '/scripts/workflows/corporation';
import {getPid, runScript} from '/scripts/workflows/execution';

const React = getReactModel().reactNS;
const useState = React.useState;

interface InterfaceControls {
  moraleLimit: HTMLInputElement | undefined;
  energyLimit: HTMLInputElement | undefined;
  partyFunds: HTMLInputElement | undefined;
}

const ENERGY_LIMIT_ID = 'energyLimit';
const MORALE_LIMIT_ID = 'moraleLimit';
const PARTY_FUNDS_ID = 'funds';

function getInterfaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    moraleLimit: doc.getElementById(MORALE_LIMIT_ID) as
      | HTMLInputElement
      | undefined,
    energyLimit: doc.getElementById(ENERGY_LIMIT_ID) as
      | HTMLInputElement
      | undefined,
    partyFunds: doc.getElementById(PARTY_FUNDS_ID) as
      | HTMLInputElement
      | undefined,
  };
  return result;
}

function handleTeaPartyConfigResponse(
  responseData: TeaPartyConfigResponse,
  netscript: NS,
  eventListener: EventListener,
  setMoraleLimit: ReactSetStateFunction<string>,
  setEnergyLimit: ReactSetStateFunction<string>,
  setPartyFunds: ReactSetStateFunction<string>
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(
    TeaPartyConfigResponse,
    handleTeaPartyConfigResponse
  );

  const config = responseData.config;
  setMoraleLimit(netscript.formatNumber(config.moraleLimit));
  setEnergyLimit(netscript.formatNumber(config.energyLimit));
  setPartyFunds(netscript.formatNumber(config.partyFunds));
}

async function handleToggleTeaParty(
  netscript: NS,
  eventListener: EventListener,
  setMoraleLimit: ReactSetStateFunction<string>,
  setEnergyLimit: ReactSetStateFunction<string>,
  setPartyFunds: ReactSetStateFunction<string>
) {
  let scriptPid = getPid(netscript, TEA_PARTY_SCRIPT);
  if (!scriptPid) {
    scriptPid = runScript(netscript, TEA_PARTY_SCRIPT);
    const config = getTeaPartyConfig();
    await sendMessageRetry(netscript, new TeaPartyConfigEvent(config));

    eventListener.addListener(
      TeaPartyConfigResponse,
      handleTeaPartyConfigResponse,
      netscript,
      eventListener,
      setMoraleLimit,
      setEnergyLimit,
      setPartyFunds
    );
    sendMessage(new TeaPartyConfigRequest(eventListener.subscriberName));
  } else {
    netscript.kill(scriptPid);
    scriptPid = 0;
  }

  return scriptPid !== 0;
}

function getTeaPartyConfig() {
  const interfaceControls = getInterfaceControls();
  let moraleLimit = parseNumber(interfaceControls.moraleLimit?.value ?? '');
  if (isNaN(moraleLimit)) {
    moraleLimit = -1;
  }
  let energyLimit = parseNumber(interfaceControls.energyLimit?.value ?? '');
  if (isNaN(energyLimit)) {
    energyLimit = -1;
  }
  let partyFunds = parseNumber(interfaceControls.partyFunds?.value ?? '');
  if (isNaN(partyFunds)) {
    partyFunds = -1;
  }
  const config: TeaPartyConfig = {
    moraleLimit: moraleLimit,
    energyLimit: energyLimit,
    partyFunds: partyFunds,
  };
  return config;
}

function sendTeaPartyConfig() {
  const config = getTeaPartyConfig();
  sendMessage(new TeaPartyConfigEvent(config));
  return true;
}

function TeaPartyUI({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const [moraleLimit, setMoraleLimit] = useState('');
  const [energyLimit, setEnergyLimit] = useState('');
  const [partyFunds, setPartyFunds] = useState('');
  const targetRunning = Boolean(getPid(netscript, TEA_PARTY_SCRIPT));

  useEffectOnce(() => {
    eventListener.addListener(
      TeaPartyConfigResponse,
      handleTeaPartyConfigResponse,
      netscript,
      eventListener,
      setMoraleLimit,
      setEnergyLimit,
      setPartyFunds
    );
    sendMessage(new TeaPartyConfigRequest(eventListener.subscriberName));
  });

  return (
    <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Tea Party Manager</label>
        <RunScriptButton
          title="Toggle tea party manager script"
          runScriptFunc={handleToggleTeaParty.bind(
            undefined,
            netscript,
            eventListener,
            setMoraleLimit,
            setEnergyLimit,
            setPartyFunds
          )}
          scriptAlreadyRunning={targetRunning}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
      </div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <LabeledInput
          id={MORALE_LIMIT_ID}
          title="Morale Limit"
          value={moraleLimit}
          setValueFunc={setMoraleLimit}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <LabeledInput
          id={ENERGY_LIMIT_ID}
          title="Energy Limit"
          value={energyLimit}
          setValueFunc={setEnergyLimit}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <LabeledInput
          id={PARTY_FUNDS_ID}
          title="Party Funds"
          value={partyFunds}
          setValueFunc={setPartyFunds}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
      </div>
      <Button onClick={sendTeaPartyConfig} uiStyle={uiStyle} uiTheme={uiTheme}>
        Send Settings
      </Button>
    </div>
  );
}

export {TeaPartyUI};
