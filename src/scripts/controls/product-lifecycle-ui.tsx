import {CityName, NS} from '@ns';

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
import {
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {getPid, runScript} from '/scripts/workflows/execution';
import {
  PRODUCT_LIFECYCLE_SCRIPT,
  ProductLifecycleConfig,
  getDivisions,
} from '/scripts/workflows/corporation';
import {Button} from '/scripts/controls/components/button';
import {LabeledInput} from '/scripts/controls/components/labeled-input';
import {ProductLifecycleConfigEvent} from '/scripts/comms/events/product-lifecycle-config-event';
import {parseNumber} from '/scripts/workflows/parsing';
import {Dropdown} from '/scripts/controls/components/dropdown';
import {CITY_NAMES} from '/scripts/common/shared';
import {ProductLifecycleConfigResponse} from '/scripts/comms/responses/product-lifecycle-config-response';
import {ProductLifecycleConfigRequest} from '/scripts/comms/requests/product-lifecycle-config-request';
import {getCmdFlag} from '/scripts/workflows/cmd-args';
import {
  CMD_FLAG_DESIGN_BUDGET,
  CMD_FLAG_DESIGN_CITY_NAME,
  CMD_FLAG_DIVISION_NAME,
  CMD_FLAG_MARKETING_BUDGET,
  CMD_FLAG_PRODUCT_NAME,
} from '/scripts/corp-product';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

interface InterfaceControls {
  divisionName?: HTMLSelectElement;
  designCity?: HTMLSelectElement;
  productName?: HTMLInputElement;
  designBudget?: HTMLInputElement;
  marketingBudget?: HTMLInputElement;
}

const React = getReactModel().reactNS;
const useState = React.useState;

const DIVISION_NAME_ID = 'product-divisionName';
const DESIGN_CITY_ID = 'designCity';
const PRODUCT_NAME_ID = 'productName';
const DESIGN_BUDGET_ID = 'designBudget';
const MARKETING_BUDGET_ID = 'marketingBudget';

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
    designBudget: doc.getElementById(DESIGN_BUDGET_ID) as
      | HTMLInputElement
      | undefined,
    marketingBudget: doc.getElementById(MARKETING_BUDGET_ID) as
      | HTMLInputElement
      | undefined,
  };
  return result;
}

function handleProductLifecycleConfigResponse(
  responseData: ProductLifecycleConfigResponse,
  netscript: NS,
  eventListener: EventListener,
  setProductName: ReactSetStateFunction<string>,
  setDesignBudget: ReactSetStateFunction<string>,
  setMarketingBudget: ReactSetStateFunction<string>
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
  setDesignBudget(netscript.formatNumber(config.designBudget));
  setMarketingBudget(netscript.formatNumber(config.marketingBudget));

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
  setDesignBudget: ReactSetStateFunction<string>,
  setMarketingBudget: ReactSetStateFunction<string>
) {
  let scriptPid = getPid(netscript, PRODUCT_LIFECYCLE_SCRIPT);
  if (!scriptPid) {
    const config = getProductLifecycleConfig();
    const scriptArgs = new Array<string>();
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
    if (!isNaN(config.designBudget)) {
      scriptArgs.push(getCmdFlag(CMD_FLAG_DESIGN_BUDGET));
      scriptArgs.push(netscript.formatNumber(config.designBudget));
    }
    if (!isNaN(config.marketingBudget)) {
      scriptArgs.push(getCmdFlag(CMD_FLAG_MARKETING_BUDGET));
      scriptArgs.push(netscript.formatNumber(config.marketingBudget));
    }
    scriptPid = runScript(
      netscript,
      PRODUCT_LIFECYCLE_SCRIPT,
      undefined,
      1,
      false,
      ...scriptArgs
    );

    eventListener.addListener(
      ProductLifecycleConfigResponse,
      handleProductLifecycleConfigResponse,
      netscript,
      eventListener,
      setProductName,
      setDesignBudget,
      setMarketingBudget
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
    designBudget: parseNumber(interfaceControls.designBudget?.value ?? ''),
    marketingBudget: parseNumber(
      interfaceControls.marketingBudget?.value ?? ''
    ),
  };
  return config;
}

function sendProductLifecycleConfig() {
  const config = getProductLifecycleConfig();
  sendMessage(new ProductLifecycleConfigEvent(config));
  return true;
}

function ProductLifecycleUI({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const [productName, setProductName] = useState('');
  const [designBudget, setDesignBudget] = useState('');
  const [marketingBudget, setMarketingBudget] = useState('');
  const targetRunning = Boolean(getPid(netscript, PRODUCT_LIFECYCLE_SCRIPT));

  const divisionNames = getDivisions(netscript).filter(
    value => netscript.corporation.getDivision(value).makesProducts
  );
  const cityNames = ['', ...CITY_NAMES];

  useEffectOnce(() => {
    eventListener.addListener(
      ProductLifecycleConfigResponse,
      handleProductLifecycleConfigResponse,
      netscript,
      eventListener,
      setProductName,
      setDesignBudget,
      setMarketingBudget
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
            setDesignBudget,
            setMarketingBudget
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
          options={divisionNames.map(divisionName => {
            return {label: divisionName, value: divisionName};
          })}
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
          title="Product"
          placeholder="Name"
          value={productName}
          setValueFunc={setProductName}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <LabeledInput
          id={DESIGN_BUDGET_ID}
          title="Design"
          placeholder="Budget"
          value={designBudget}
          setValueFunc={setDesignBudget}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <LabeledInput
          id={MARKETING_BUDGET_ID}
          title="Marketing"
          placeholder="Budget"
          value={marketingBudget}
          setValueFunc={setMarketingBudget}
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
