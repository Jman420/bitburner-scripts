import {NS} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
  handleDisableTerminal,
  handleEnableTerminal,
  handleNumericInputChange,
} from '/scripts/workflows/ui';

import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {StocksTraderConfigResponse} from '/scripts/comms/responses/stocks-trader-config-response';
import {StocksTraderConfigRequest} from '/scripts/comms/requests/stocks-trader-config-request';
import {StocksTraderConfigEvent} from '/scripts/comms/events/stocks-trader-config-event';

import {
  STOCKS_TRADER_SCRIPT,
  StocksTraderConfig,
} from '/scripts/workflows/stocks';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {getPid, runScript} from '/scripts/workflows/execution';

import {
  BUTTON_CSS_CLASS,
  DIV_BORDER_CSS_CLASS,
  HEADER_DIV_STYLE,
  HEADER_LABEL_STYLE,
  TEXTBOX_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
} from '/scripts/controls/style-sheet';
import {ToggleButton} from '/scripts/controls/components/toggle-button';

interface InterfaceControls {
  shortSales: HTMLButtonElement | undefined;
  purchaseStocks: HTMLButtonElement | undefined;
  fundsLimit: HTMLInputElement | undefined;
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
const INPUT_STYLE: React.CSSProperties = {
  fontSize: '14pt',
  textAlign: 'center',
  display: 'block',
};

const SHORT_SALES_BUTTON_ID = 'shortSales';
const PURCHASE_STOCKS_BUTTON_ID = 'purchaseStocks';
const FUNDS_LIMIT_INPUT_ID = 'fundsLimit';
const SET_FUNDS_LIMIT_BUTTON_ID = 'setFundsLimit';

function getInterfaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    shortSales: (doc.getElementById(SHORT_SALES_BUTTON_ID) ?? undefined) as
      | HTMLButtonElement
      | undefined,
    purchaseStocks: (doc.getElementById(PURCHASE_STOCKS_BUTTON_ID) ??
      undefined) as HTMLButtonElement | undefined,
    fundsLimit: (doc.getElementById(FUNDS_LIMIT_INPUT_ID) ?? undefined) as
      | HTMLInputElement
      | undefined,
  };
  return result;
}

function handleStocksTraderConfigResponse(
  responseData: StocksTraderConfigResponse,
  netscript: NS,
  eventListener: EventListener,
  setFundsLimit: ReactSetStateFunction<string>
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(
    StocksTraderConfigResponse,
    handleStocksTraderConfigResponse
  );

  const interfaceControls = getInterfaceControls();
  interfaceControls.shortSales?.classList.remove(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );
  interfaceControls.purchaseStocks?.classList.remove(
    TOGGLE_BUTTON_SELECTED_CSS_CLASS
  );

  const config = responseData.config;
  if (config.shortSales) {
    interfaceControls.shortSales?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }
  if (config.purchaseStocks) {
    interfaceControls.purchaseStocks?.classList.add(
      TOGGLE_BUTTON_SELECTED_CSS_CLASS
    );
  }
  setFundsLimit(netscript.formatNumber(config.fundsLimit));
}

function handleTradeSettingsClick(
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  sendStockTraderConfig();
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

  sendStockTraderConfig();
}

function getStockTraderConfig() {
  const interfaceControls = getInterfaceControls();

  let fundsLimit = parseInt(
    interfaceControls.fundsLimit?.value.replaceAll(',', '') ?? ''
  );
  if (isNaN(fundsLimit)) {
    fundsLimit = -1;
  }

  const config: StocksTraderConfig = {
    shortSales:
      interfaceControls.shortSales?.classList.contains(
        TOGGLE_BUTTON_SELECTED_CSS_CLASS
      ) ?? false,
    purchaseStocks:
      interfaceControls.purchaseStocks?.classList.contains(
        TOGGLE_BUTTON_SELECTED_CSS_CLASS
      ) ?? false,
    fundsLimit: fundsLimit,
  };
  return config;
}

function sendStockTraderConfig() {
  const config = getStockTraderConfig();
  sendMessage(new StocksTraderConfigEvent(config));
}

async function handleToggleStockTrader(
  netscript: NS,
  eventListener: EventListener,
  setFundsLimit: ReactSetStateFunction<string>
) {
  let scriptPid = getPid(netscript, STOCKS_TRADER_SCRIPT);
  if (!scriptPid) {
    scriptPid = runScript(netscript, STOCKS_TRADER_SCRIPT);
    const config = getStockTraderConfig();
    await sendMessageRetry(netscript, new StocksTraderConfigEvent(config));

    eventListener.addListener(
      StocksTraderConfigResponse,
      handleStocksTraderConfigResponse,
      netscript,
      eventListener,
      setFundsLimit
    );
    sendMessage(new StocksTraderConfigRequest(eventListener.subscriberName));
  } else {
    netscript.kill(scriptPid);
    scriptPid = 0;
  }

  return scriptPid !== 0;
}

function StocksTraderUI({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  const [fundsLimit, setFundsLimit] = useState('');

  useEffectOnce(() => {
    eventListener.addListener(
      StocksTraderConfigResponse,
      handleStocksTraderConfigResponse,
      netscript,
      eventListener,
      setFundsLimit
    );
    sendMessageRetry(
      netscript,
      new StocksTraderConfigRequest(eventListener.subscriberName)
    );
  });

  return (
    <div>
      <div style={HEADER_DIV_STYLE}>
        <label style={HEADER_LABEL_STYLE}>Stock Trader</label>
        <RunScriptButton
          title="Run stock trader script"
          runScriptFunc={handleToggleStockTrader.bind(
            undefined,
            netscript,
            eventListener,
            setFundsLimit
          )}
        />
      </div>
      <label style={LABEL_STYLE}>Trading Settings</label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <ToggleButton
          id={SHORT_SALES_BUTTON_ID}
          onClick={handleTradeSettingsClick}
        >
          Short Sales
        </ToggleButton>
        <ToggleButton
          id={PURCHASE_STOCKS_BUTTON_ID}
          onClick={handleTradeSettingsClick}
        >
          Purchase Stocks
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

export {StocksTraderUI};
