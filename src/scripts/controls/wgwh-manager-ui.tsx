import {NS} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
} from '/scripts/workflows/ui';
import {getPid, runScript} from '/scripts/workflows/execution';
import {
  BATCH_ATTACK_SCRIPT,
  DEFAULT_OPTIMAL_ONLY_COUNT,
  DEFAULT_HACK_FUNDS_PERCENT,
  SERIAL_ATTACK_SCRIPT,
  WgwhAttackConfig,
  DEFAULT_TARGET_FUNDS_LIMIT_PERCENT,
} from '/scripts/workflows/attacks';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {WgwhManagerConfigEvent} from '/scripts/comms/events/wgwh-manager-config-event';
import {WgwhConfigRequest} from '/scripts/comms/requests/wgwh-config-request';
import {WgwhConfigResponse} from '/scripts/comms/responses/wgwh-config-response';

import {
  BUTTON_CSS_CLASS,
  DIV_BORDER_CSS_CLASS,
  HEADER_DIV_STYLE,
  HEADER_LABEL_STYLE,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {ExclusiveToggleButton} from '/scripts/controls/components/exclusive-toggle-button';
import {ToggleButton} from '/scripts/controls/components/toggle-button';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';
import {LabeledTextbox} from '/scripts/controls/components/labeled-textbox';

enum AttackManagerRunning {
  SERIAL,
  BATCH,
  NONE,
}

interface InterfaceControls {
  serialAttack: HTMLButtonElement | undefined;
  batchAttack: HTMLButtonElement | undefined;
  includeHomeAttacker: HTMLButtonElement | undefined;
  optimalOnlyCount: HTMLInputElement | undefined;
  hackFundsPercent: HTMLInputElement | undefined;
  fundsLimitPercent: HTMLInputElement | undefined;
  targetHosts: HTMLInputElement | undefined;
  attackerHosts: HTMLInputElement | undefined;
}

const React = getReactModel().reactNS;
const useState = React.useState;

const DIV_STYLE: React.CSSProperties = {
  alignItems: 'center',
  textAlign: 'center',
};
const LABEL_STYLE: React.CSSProperties = {
  fontSize: '14pt',
  textAlign: 'center',
  display: 'block',
};

const SERIAL_ATTACK_ID = 'serialAttack';
const BATCH_ATTACK_ID = 'batchAttack';
const ATTACK_TYPE_GROUP_CLASS = 'attackType';

const INCLUDE_HOME_ATTACKER_ID = 'includeHome';
const OPTIMAL_ONLY_COUNT_ID = 'optimalOnlyCount';
const HACK_FUNDS_PERCENT_ID = 'hackFundsPercent';
const FUNDS_LIMIT_PERCENT_ID = 'fundsLimitPercent';
const TARGET_HOSTS_ID = 'targetHosts';
const ATTACKER_HOSTS_ID = 'attackerHosts';
const SEND_SETTINGS_BUTTON_ID = 'sendSettings';

function getInterfaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    serialAttack: (doc.getElementById(SERIAL_ATTACK_ID) ?? undefined) as
      | HTMLButtonElement
      | undefined,
    batchAttack: (doc.getElementById(BATCH_ATTACK_ID) ?? undefined) as
      | HTMLButtonElement
      | undefined,
    includeHomeAttacker: (doc.getElementById(INCLUDE_HOME_ATTACKER_ID) ??
      undefined) as HTMLButtonElement | undefined,
    optimalOnlyCount: (doc.getElementById(OPTIMAL_ONLY_COUNT_ID) ??
      undefined) as HTMLInputElement | undefined,
    hackFundsPercent: (doc.getElementById(HACK_FUNDS_PERCENT_ID) ??
      undefined) as HTMLInputElement | undefined,
    fundsLimitPercent: (doc.getElementById(FUNDS_LIMIT_PERCENT_ID) ??
      undefined) as HTMLInputElement | undefined,
    targetHosts: (doc.getElementById(TARGET_HOSTS_ID) ?? undefined) as
      | HTMLInputElement
      | undefined,
    attackerHosts: (doc.getElementById(ATTACKER_HOSTS_ID) ?? undefined) as
      | HTMLInputElement
      | undefined,
  };
  return result;
}

function handleWgwhConfigResponse(
  responseData: WgwhConfigResponse,
  eventListener: EventListener,
  setOptimalOnlyCount: ReactSetStateFunction<string>,
  setHackFundsPercent: ReactSetStateFunction<string>,
  setFundsLimitPercent: ReactSetStateFunction<string>,
  setTargetHosts: ReactSetStateFunction<string[]>,
  setAttackerHosts: ReactSetStateFunction<string[]>
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(WgwhConfigResponse, handleWgwhConfigResponse);

  const config = responseData.config;
  const interfaceControls = getInterfaceControls();
  if (config.includeHomeAttacker) {
    interfaceControls.includeHomeAttacker?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }
  setOptimalOnlyCount(`${config.optimalOnlyCount}`);
  setHackFundsPercent(`${config.hackFundsPercent}`);
  setFundsLimitPercent(`${config.targetFundsLimitPercent}`);
  setTargetHosts(config.targetHosts);
  setAttackerHosts(config.attackerHosts);
}

function handleAttackSettingsClick(netscript: NS) {
  const interfaceControls = getInterfaceControls();
  const serialSelected =
    interfaceControls.serialAttack?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    ) ?? false;
  const serialRunning = getPid(netscript, SERIAL_ATTACK_SCRIPT);
  const batchSelected =
    interfaceControls.batchAttack?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    ) ?? false;
  const batchRunning = getPid(netscript, BATCH_ATTACK_SCRIPT);

  return (
    (!serialRunning && !batchRunning) ||
    (serialSelected && !serialRunning) ||
    (batchSelected && !batchRunning)
  );
}

function getWgwhConfig() {
  const interfaceControls = getInterfaceControls();
  const includeHomeAttacker =
    interfaceControls.includeHomeAttacker?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    ) ?? false;
  const optimalOnlyCount =
    parseInt(
      interfaceControls.optimalOnlyCount?.value ??
        `${DEFAULT_OPTIMAL_ONLY_COUNT}`
    ) || DEFAULT_OPTIMAL_ONLY_COUNT;
  const hackFundsPercent =
    parseFloat(
      interfaceControls.hackFundsPercent?.value ??
        `${DEFAULT_HACK_FUNDS_PERCENT}`
    ) || DEFAULT_HACK_FUNDS_PERCENT;
  const fundsLimitPercent =
    parseFloat(
      interfaceControls.fundsLimitPercent?.value ??
        `${DEFAULT_TARGET_FUNDS_LIMIT_PERCENT}`
    ) || DEFAULT_TARGET_FUNDS_LIMIT_PERCENT;
  const targetHosts =
    interfaceControls.targetHosts?.value
      .split(',')
      .map(value => value.trim())
      .filter(value => value !== '') ?? [];
  const attackerHosts =
    interfaceControls.attackerHosts?.value
      .split(',')
      .map(value => value.trim())
      .filter(value => value !== '') ?? [];

  const result: WgwhAttackConfig = {
    includeHomeAttacker: includeHomeAttacker,
    optimalOnlyCount: optimalOnlyCount,
    hackFundsPercent: hackFundsPercent,
    targetFundsLimitPercent: fundsLimitPercent,
    targetHosts: targetHosts,
    attackerHosts: attackerHosts,
  };
  return result;
}

function sendWgwhConfig() {
  const config = getWgwhConfig();
  sendMessage(new WgwhManagerConfigEvent(config));
  return true;
}

async function handleToggleManager(
  netscript: NS,
  eventListener: EventListener,
  setOptimalOnlyCount: ReactSetStateFunction<string>,
  setHackFundsPercent: ReactSetStateFunction<string>,
  setFundsLimitPercent: ReactSetStateFunction<string>,
  setTargetHosts: ReactSetStateFunction<string[]>,
  setAttackerHosts: ReactSetStateFunction<string[]>
) {
  const interfaceControls = getInterfaceControls();
  const serialAttack = interfaceControls.serialAttack?.classList.contains(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );
  const batchAttack = interfaceControls.batchAttack?.classList.contains(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );
  let attackManagerScript = BATCH_ATTACK_SCRIPT;
  if (batchAttack) {
    attackManagerScript = BATCH_ATTACK_SCRIPT;
  } else if (serialAttack) {
    attackManagerScript = SERIAL_ATTACK_SCRIPT;
  }

  let scriptPid = getPid(netscript, attackManagerScript);
  if (!scriptPid) {
    scriptPid = runScript(netscript, attackManagerScript);
    const config = getWgwhConfig();
    await sendMessageRetry(netscript, new WgwhManagerConfigEvent(config));

    eventListener.addListener(
      WgwhConfigResponse,
      handleWgwhConfigResponse,
      eventListener,
      setOptimalOnlyCount,
      setHackFundsPercent,
      setFundsLimitPercent,
      setTargetHosts,
      setAttackerHosts
    );
    sendMessage(new WgwhConfigRequest(eventListener.subscriberName));
  } else {
    netscript.kill(scriptPid);
    scriptPid = 0;
  }

  return scriptPid !== 0;
}

function WgwhManagerUI({
  netscript,
  eventListener,
  attackManagerRunning,
}: {
  netscript: NS;
  eventListener: EventListener;
  attackManagerRunning: AttackManagerRunning;
}) {
  const [optimalOnlyCount, setOptimalOnlyCount] = useState('');
  const [hackFundsPercent, setHackFundsPercent] = useState('');
  const [fundsLimitPercent, setFundsLimitPercent] = useState('');
  const [targetHosts, setTargetHosts] = useState(new Array<string>());
  const [attackerHosts, setAttackerHosts] = useState(new Array<string>());

  useEffectOnce(() => {
    eventListener.addListener(
      WgwhConfigResponse,
      handleWgwhConfigResponse,
      eventListener,
      setOptimalOnlyCount,
      setHackFundsPercent,
      setFundsLimitPercent,
      setTargetHosts,
      setAttackerHosts
    );
    sendMessage(new WgwhConfigRequest(eventListener.subscriberName));
  });

  return (
    <div>
      <div style={HEADER_DIV_STYLE}>
        <label style={HEADER_LABEL_STYLE}>WeakenGrow WeakenHack Attack</label>
        <RunScriptButton
          title="Run weaken-grow weaken-hack attack script"
          runScriptFunc={handleToggleManager.bind(
            undefined,
            netscript,
            eventListener,
            setOptimalOnlyCount,
            setHackFundsPercent,
            setFundsLimitPercent,
            setTargetHosts,
            setAttackerHosts
          )}
          scriptAlreadyRunning={
            attackManagerRunning !== AttackManagerRunning.NONE
          }
        />
      </div>
      <label style={LABEL_STYLE}>Manager Settings</label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <ExclusiveToggleButton
          id={SERIAL_ATTACK_ID}
          exclusiveGroup={ATTACK_TYPE_GROUP_CLASS}
          onClickBefore={handleAttackSettingsClick.bind(undefined, netscript)}
          selected={attackManagerRunning === AttackManagerRunning.SERIAL}
        >
          Serial
        </ExclusiveToggleButton>
        <ExclusiveToggleButton
          id={BATCH_ATTACK_ID}
          exclusiveGroup={ATTACK_TYPE_GROUP_CLASS}
          onClickBefore={handleAttackSettingsClick.bind(undefined, netscript)}
          selected={attackManagerRunning === AttackManagerRunning.BATCH}
        >
          Batch
        </ExclusiveToggleButton>
      </div>
      <label style={LABEL_STYLE}>Attack Settings</label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <ToggleButton id={INCLUDE_HOME_ATTACKER_ID} onClick={sendWgwhConfig}>
          Include Home Attacker
        </ToggleButton>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <LabeledTextbox
              id={OPTIMAL_ONLY_COUNT_ID}
              title="Optimal Only #"
              value={optimalOnlyCount}
              setValueFunc={setOptimalOnlyCount}
            />
            <LabeledTextbox
              id={HACK_FUNDS_PERCENT_ID}
              title="Hack Funds %"
              value={hackFundsPercent}
              setValueFunc={setHackFundsPercent}
            />
            <LabeledTextbox
              id={FUNDS_LIMIT_PERCENT_ID}
              title="Funds Limit %"
              value={fundsLimitPercent}
              setValueFunc={setFundsLimitPercent}
            />
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <LabeledTextbox
              id={TARGET_HOSTS_ID}
              title="Target Hosts"
              placeholder="Set target hosts"
              value={targetHosts.join(', ')}
              setValueFunc={() => {}}
            />
            <LabeledTextbox
              id={ATTACKER_HOSTS_ID}
              title="Attacker Hosts"
              placeholder="Set attacker hosts"
              value={attackerHosts.join(', ')}
              setValueFunc={() => {}}
            />
          </div>
        </div>
        <button
          id={SEND_SETTINGS_BUTTON_ID}
          className={BUTTON_CSS_CLASS}
          onClick={sendWgwhConfig}
        >
          Send Settings
        </button>
      </div>
    </div>
  );
}

export {AttackManagerRunning, WgwhManagerUI};
