import {CityName, NS} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
} from '/scripts/workflows/ui';

import {
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {Button} from '/scripts/controls/components/button';
import {LabeledInput} from '/scripts/controls/components/labeled-input';
import {Dropdown, DropdownOption} from '/scripts/controls/components/dropdown';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

import {CITY_NAMES} from '/scripts/common/shared';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {ProductLifecycleConfigEvent} from '/scripts/comms/events/product-lifecycle-config-event';
import {ProductLifecycleConfigResponse} from '/scripts/comms/responses/product-lifecycle-config-response';
import {ProductLifecycleConfigRequest} from '/scripts/comms/requests/product-lifecycle-config-request';

import {parseNumber} from '/scripts/workflows/parsing';
import {getPid, runScript} from '/scripts/workflows/execution';
import {getCmdFlag} from '/scripts/workflows/cmd-args';
import {
  PRODUCT_LIFECYCLE_SCRIPT,
  ProductLifecycleConfig,
} from '/scripts/workflows/corporation-shared';
import {
  CMD_FLAG_DESIGN_CITY_NAME,
  CMD_FLAG_DIVISION_NAME,
  CMD_FLAG_PRODUCT_NAME,
  CMD_FLAG_BUDGET_PERCENT,
} from '/scripts/corp-product';
import {FRAUD_DIVISION_NAME_PREFIX} from '/scripts/workflows/corporation-shared';
import {NetscriptPackage} from '/scripts/netscript-services/netscript-ghost';

interface InterfaceControls {
  divisionName?: HTMLSelectElement;
  designCity?: HTMLSelectElement;
  productName?: HTMLInputElement;
  budgetPercent?: HTMLInputElement;
}

const React = getReactModel().reactNS;
const useState = React.useState;

const DIVISION_NAME_ID = 'product-divisionName';
const DESIGN_CITY_ID = 'designCity';
const PRODUCT_NAME_ID = 'productName';
const BUDGET_PERCENT_ID = 'budgetPercent';

function getInterfaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    divisionName: doc.getElementById(DIVISION_NAME_ID) as
      | HTMLSelectElement
      | undefined,
    designCity: doc.getElementById(DESIGN_CITY_ID) as
      | HTMLSelectElement
      | undefined,
    productName: doc.getElementById(PRODUCT_NAME_ID) as
      | HTMLInputElement
      | undefined,
    budgetPercent: doc.getElementById(BUDGET_PERCENT_ID) as HTMLInputElement,
  };
  return result;
}

function handleProductLifecycleConfigResponse(
  responseData: ProductLifecycleConfigResponse,
  netscript: NS,
  eventListener: EventListener,
  setProductName: ReactSetStateFunction<string>,
  setBudgetPercent: ReactSetStateFunction<string>
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(
    ProductLifecycleConfigResponse,
    handleProductLifecycleConfigResponse
  );

  const config = responseData.config;
  setProductName(config.productName);
  setBudgetPercent(netscript.formatNumber(config.budgetPercent, 2));

  const interfaceControls = getInterfaceControls();
  if (interfaceControls.divisionName) {
    interfaceControls.divisionName.value = config.divisionName;
  }
  if (interfaceControls.designCity) {
    interfaceControls.designCity.value = config.designCity;
  }
}

async function handleToggleProductLifecycleManager(
  netscript: NS,
  eventListener: EventListener,
  setProductName: ReactSetStateFunction<string>,
  setBudgetPercent: ReactSetStateFunction<string>
) {
  let scriptPid = getPid(netscript, PRODUCT_LIFECYCLE_SCRIPT);
  if (!scriptPid) {
    const config = getProductLifecycleConfig();
    const scriptArgs = [];
    if (config.divisionName) {
      scriptArgs.push(getCmdFlag(CMD_FLAG_DIVISION_NAME));
      scriptArgs.push(config.divisionName);
    }
    if (config.designCity) {
      scriptArgs.push(getCmdFlag(CMD_FLAG_DESIGN_CITY_NAME));
      scriptArgs.push(config.designCity);
    }
    if (config.productName) {
      scriptArgs.push(getCmdFlag(CMD_FLAG_PRODUCT_NAME));
      scriptArgs.push(config.productName);
    }
    if (!isNaN(config.budgetPercent)) {
      scriptArgs.push(getCmdFlag(CMD_FLAG_BUDGET_PERCENT));
      scriptArgs.push(netscript.formatNumber(config.budgetPercent));
    }
    scriptPid = runScript(netscript, PRODUCT_LIFECYCLE_SCRIPT, {
      args: scriptArgs,
    });

    eventListener.addListener(
      ProductLifecycleConfigResponse,
      handleProductLifecycleConfigResponse,
      netscript,
      eventListener,
      setProductName,
      setBudgetPercent
    );
    sendMessageRetry(
      netscript,
      new ProductLifecycleConfigRequest(eventListener.subscriberName)
    );
  } else {
    netscript.kill(scriptPid);
    scriptPid = 0;
  }

  return scriptPid !== 0;
}

function getProductLifecycleConfig() {
  const interfaceControls = getInterfaceControls();
  const config: ProductLifecycleConfig = {
    divisionName:
      interfaceControls.divisionName?.selectedOptions[0].value ?? '',
    designCity: (interfaceControls.designCity?.selectedOptions[0].value ??
      'Sector-12') as CityName,
    productName: interfaceControls.productName?.value ?? '',
    budgetPercent: parseNumber(interfaceControls.budgetPercent?.value ?? ''),
  };
  return config;
}

function sendProductLifecycleConfig() {
  const config = getProductLifecycleConfig();
  sendMessage(new ProductLifecycleConfigEvent(config));
  return true;
}

function ProductLifecycleUI({
  nsPackage,
  eventListener,
}: {
  nsPackage: NetscriptPackage;
  eventListener: EventListener;
}) {
  const nsLocator = nsPackage.ghost;
  const netscript = nsPackage.netscript;

  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const [productName, setProductName] = useState('');
  const [budgetPercent, setBudgetPercent] = useState('');
  const [divisionOptions, setDivisionOptions] = useState(
    [] as DropdownOption[]
  );
  const targetRunning = Boolean(getPid(netscript, PRODUCT_LIFECYCLE_SCRIPT));
  const cityNames = ['', ...CITY_NAMES];

  useEffectOnce(() => {
    async function refreshDivisionOptions() {
      const corpApi = nsLocator.corporation;
      const corpInfo = await corpApi['getCorporation']();
      const options = [];
      for (const divisionName of corpInfo.divisions) {
        const divisionInfo = await corpApi['getDivision'](divisionName);
        if (
          divisionInfo.makesProducts &&
          !divisionName.includes(FRAUD_DIVISION_NAME_PREFIX)
        ) {
          options.push({label: divisionName, value: divisionName});
        }
      }
      setDivisionOptions(options);
    }
    refreshDivisionOptions();
  });

  useEffectOnce(() => {
    eventListener.addListener(
      ProductLifecycleConfigResponse,
      handleProductLifecycleConfigResponse,
      netscript,
      eventListener,
      setProductName,
      setBudgetPercent
    );
    sendMessage(
      new ProductLifecycleConfigRequest(eventListener.subscriberName)
    );
  });

  return (
    <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Product Lifecycle Manager</label>
        <RunScriptButton
          title="Toggle product lifecycle manager script"
          runScriptFunc={handleToggleProductLifecycleManager.bind(
            undefined,
            netscript,
            eventListener,
            setProductName,
            setBudgetPercent
          )}
          scriptAlreadyRunning={targetRunning}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
      </div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <Dropdown
          id={DIVISION_NAME_ID}
          title="Division"
          options={divisionOptions}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <Dropdown
          id={DESIGN_CITY_ID}
          title="Design City"
          options={cityNames.map(cityName => {
            return {label: cityName, value: cityName};
          })}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <LabeledInput
          id={PRODUCT_NAME_ID}
          title="Product Name"
          placeholder="Name"
          value={productName}
          setValue={setProductName}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <LabeledInput
          id={BUDGET_PERCENT_ID}
          title="Budget Percent"
          placeholder="Percent"
          value={budgetPercent}
          setValue={setBudgetPercent}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
      </div>
      <Button
        onClick={sendProductLifecycleConfig}
        uiStyle={uiStyle}
        uiTheme={uiTheme}
      >
        Send Settings
      </Button>
    </div>
  );
}

export {ProductLifecycleUI};
