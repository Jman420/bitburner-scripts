import {NS, UserInterfaceTheme} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
} from '/scripts/workflows/ui';
import {getPid, runScript} from '/scripts/workflows/execution';
import {
  DEFAULT_OPTIMAL_ONLY_COUNT,
  DEFAULT_HACK_FUNDS_PERCENT,
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
  TOGGLE_BUTTON_SELECTED_CLASS,
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {ExclusiveToggleButton} from '/scripts/controls/components/exclusive-toggle-button';
import {ToggleButton} from '/scripts/controls/components/toggle-button';
import {LabeledInput} from '/scripts/controls/components/labeled-input';
import {Button} from '/scripts/controls/components/button';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';
import {WGWH_SERIAL_ATTACK_SCRIPT} from '/scripts/wgwh-serial';
import {WGWH_BATCH_ATTACK_SCRIPT} from '/scripts/wgwh-batch';

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
  setAttackerHosts: ReactSetStateFunction<string[]>,
  uiTheme: UserInterfaceTheme
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(WgwhConfigResponse, handleWgwhConfigResponse);

  const config = responseData.config;
  const interfaceControls = getInterfaceControls();
  if (config.includeHomeAttacker && interfaceControls.includeHomeAttacker) {
    interfaceControls.includeHomeAttacker.classList.add(
      TOGGLE_BUTTON_SELECTED_CLASS
    );
    interfaceControls.includeHomeAttacker.style.color = uiTheme.primary;
    interfaceControls.includeHomeAttacker.style.backgroundColor =
      uiTheme.button;
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
      TOGGLE_BUTTON_SELECTED_CLASS
    ) ?? false;
  const serialRunning = getPid(netscript, WGWH_SERIAL_ATTACK_SCRIPT);
  const batchSelected =
    interfaceControls.batchAttack?.classList.contains(
      TOGGLE_BUTTON_SELECTED_CLASS
    ) ?? false;
  const batchRunning = getPid(netscript, WGWH_BATCH_ATTACK_SCRIPT);

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
      TOGGLE_BUTTON_SELECTED_CLASS
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
  setAttackerHosts: ReactSetStateFunction<string[]>,
  uiTheme: UserInterfaceTheme
) {
  const interfaceControls = getInterfaceControls();
  const serialAttack = interfaceControls.serialAttack?.classList.contains(
    TOGGLE_BUTTON_SELECTED_CLASS
  );
  const batchAttack = interfaceControls.batchAttack?.classList.contains(
    TOGGLE_BUTTON_SELECTED_CLASS
  );
  let attackManagerScript = WGWH_BATCH_ATTACK_SCRIPT;
  if (batchAttack) {
    attackManagerScript = WGWH_BATCH_ATTACK_SCRIPT;
  } else if (serialAttack) {
    attackManagerScript = WGWH_SERIAL_ATTACK_SCRIPT;
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
      setAttackerHosts,
      uiTheme
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
  const uiTheme = netscript.ui.getTheme();
  const uiStyle = netscript.ui.getStyles();

  const [optimalOnlyCount, setOptimalOnlyCount] = useState('');
  const [hackFundsPercent, setHackFundsPercent] = useState('');
  const [fundsLimitPercent, setFundsLimitPercent] = useState('');
  const [targetHosts, setTargetHosts] = useState([] as string[]);
  const [attackerHosts, setAttackerHosts] = useState([] as string[]);

  useEffectOnce(() => {
    eventListener.addListener(
      WgwhConfigResponse,
      handleWgwhConfigResponse,
      eventListener,
      setOptimalOnlyCount,
      setHackFundsPercent,
      setFundsLimitPercent,
      setTargetHosts,
      setAttackerHosts,
      uiTheme
    );
    sendMessage(new WgwhConfigRequest(eventListener.subscriberName));
  });

  const divBorderStyle = getDivBorderStyle(uiStyle, uiTheme);
  divBorderStyle.alignItems = 'center';
  divBorderStyle.textAlign = 'center';

  return (
    <div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>
          WeakenGrow WeakenHack Attack
        </label>
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
            setAttackerHosts,
            uiTheme
          )}
          scriptAlreadyRunning={
            attackManagerRunning !== AttackManagerRunning.NONE
          }
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
      </div>
      <label style={LABEL_STYLE}>Manager Settings</label>
      <div style={divBorderStyle}>
        <ExclusiveToggleButton
          id={SERIAL_ATTACK_ID}
          exclusiveGroup={ATTACK_TYPE_GROUP_CLASS}
          onClickBefore={handleAttackSettingsClick.bind(undefined, netscript)}
          selected={attackManagerRunning === AttackManagerRunning.SERIAL}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Serial
        </ExclusiveToggleButton>
        <ExclusiveToggleButton
          id={BATCH_ATTACK_ID}
          exclusiveGroup={ATTACK_TYPE_GROUP_CLASS}
          onClickBefore={handleAttackSettingsClick.bind(undefined, netscript)}
          selected={attackManagerRunning === AttackManagerRunning.BATCH}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Batch
        </ExclusiveToggleButton>
      </div>
      <label style={LABEL_STYLE}>Attack Settings</label>
      <div style={divBorderStyle}>
        <ToggleButton
          id={INCLUDE_HOME_ATTACKER_ID}
          onClick={sendWgwhConfig}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
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
            <LabeledInput
              id={OPTIMAL_ONLY_COUNT_ID}
              title="Optimal Only #"
              value={optimalOnlyCount}
              setValue={setOptimalOnlyCount}
              uiStyle={uiStyle}
              uiTheme={uiTheme}
            />
            <LabeledInput
              id={HACK_FUNDS_PERCENT_ID}
              title="Hack Funds %"
              value={hackFundsPercent}
              setValue={setHackFundsPercent}
              uiStyle={uiStyle}
              uiTheme={uiTheme}
            />
            <LabeledInput
              id={FUNDS_LIMIT_PERCENT_ID}
              title="Funds Limit %"
              value={fundsLimitPercent}
              setValue={setFundsLimitPercent}
              uiStyle={uiStyle}
              uiTheme={uiTheme}
            />
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <LabeledInput
              id={TARGET_HOSTS_ID}
              title="Target Hosts"
              placeholder="Set target hosts"
              value={targetHosts.join(', ')}
              setValue={() => {}}
              uiStyle={uiStyle}
              uiTheme={uiTheme}
            />
            <LabeledInput
              id={ATTACKER_HOSTS_ID}
              title="Attacker Hosts"
              placeholder="Set attacker hosts"
              value={attackerHosts.join(', ')}
              setValue={() => {}}
              uiStyle={uiStyle}
              uiTheme={uiTheme}
            />
          </div>
        </div>
        <Button onClick={sendWgwhConfig} uiStyle={uiStyle} uiTheme={uiTheme}>
          Send Settings
        </Button>
      </div>
    </div>
  );
}

export {AttackManagerRunning, WgwhManagerUI};
