import {NS, UserInterfaceTheme} from '@ns';

import {
  ReactSetStateFunction,
  getDocument,
  getReactModel,
} from '/scripts/workflows/ui';
import {StocksTraderConfig} from '/scripts/workflows/stocks';
import {getPid, runScript} from '/scripts/workflows/execution';

import {
  EventListener,
  sendMessage,
  sendMessageRetry,
} from '/scripts/comms/event-comms';
import {StocksTraderConfigResponse} from '/scripts/comms/responses/stocks-trader-config-response';
import {StocksTraderConfigRequest} from '/scripts/comms/requests/stocks-trader-config-request';
import {StocksTraderConfigEvent} from '/scripts/comms/events/stocks-trader-config-event';

import {
  TOGGLE_BUTTON_SELECTED_CLASS,
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
  getLabelStyle,
} from '/scripts/controls/style-sheet';
import {RunScriptButton} from '/scripts/controls/components/run-script-button';
import {ToggleButton} from '/scripts/controls/components/toggle-button';
import {Button} from '/scripts/controls/components/button';
import {Input} from '/scripts/controls/components/input';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

import {parseNumber} from '/scripts/workflows/parsing';
import {STOCKS_TRADER_SCRIPT} from '/scripts/stocks-trader';

interface InterfaceControls {
  shortSales: HTMLButtonElement | undefined;
  purchaseStocks: HTMLButtonElement | undefined;
  fundsLimit: HTMLInputElement | undefined;
}

const React = getReactModel().reactNS;
const useState = React.useState;

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
  setFundsLimit: ReactSetStateFunction<string>,
  uiTheme: UserInterfaceTheme
) {
  if (!responseData.config) {
    return;
  }
  eventListener.removeListeners(
    StocksTraderConfigResponse,
    handleStocksTraderConfigResponse
  );

  const config = responseData.config;
  const interfaceControls = getInterfaceControls();
  if (interfaceControls.shortSales) {
    const shortSalesButton = interfaceControls.shortSales;
    shortSalesButton.classList.remove(TOGGLE_BUTTON_SELECTED_CLASS);
    shortSalesButton.style.color = uiTheme.secondary;
    shortSalesButton.style.backgroundColor = uiTheme.backgroundprimary;

    if (config.shortSales) {
      shortSalesButton.classList.add(TOGGLE_BUTTON_SELECTED_CLASS);
      shortSalesButton.style.color = uiTheme.primary;
      shortSalesButton.style.backgroundColor = uiTheme.button;
    }
  }
  if (interfaceControls.purchaseStocks) {
    const purchaseStocksButton = interfaceControls.purchaseStocks;
    purchaseStocksButton.classList.remove(TOGGLE_BUTTON_SELECTED_CLASS);
    purchaseStocksButton.style.color = uiTheme.secondary;
    purchaseStocksButton.style.backgroundColor = uiTheme.backgroundprimary;

    if (config.purchaseStocks) {
      purchaseStocksButton.classList.add(TOGGLE_BUTTON_SELECTED_CLASS);
      purchaseStocksButton.style.color = uiTheme.primary;
      purchaseStocksButton.style.backgroundColor = uiTheme.button;
    }
  }
  setFundsLimit(netscript.formatNumber(config.fundsLimit));
}

function handleTradeSettingsClick(
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  sendStockTraderConfig();
  return true;
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

  let fundsLimit = parseNumber(interfaceControls.fundsLimit?.value ?? '');
  if (isNaN(fundsLimit)) {
    fundsLimit = -1;
  }

  const config: StocksTraderConfig = {
    shortSales:
      interfaceControls.shortSales?.classList.contains(
        TOGGLE_BUTTON_SELECTED_CLASS
      ) ?? false,
    purchaseStocks:
      interfaceControls.purchaseStocks?.classList.contains(
        TOGGLE_BUTTON_SELECTED_CLASS
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
  setFundsLimit: ReactSetStateFunction<string>,
  uiTheme: UserInterfaceTheme
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
      setFundsLimit,
      uiTheme
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
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const [fundsLimit, setFundsLimit] = useState('');
  const traderRunning = Boolean(getPid(netscript, STOCKS_TRADER_SCRIPT));

  useEffectOnce(() => {
    eventListener.addListener(
      StocksTraderConfigResponse,
      handleStocksTraderConfigResponse,
      netscript,
      eventListener,
      setFundsLimit,
      uiTheme
    );
    sendMessage(new StocksTraderConfigRequest(eventListener.subscriberName));
  });

  const divBorderStyle = getDivBorderStyle(uiStyle, uiTheme);
  divBorderStyle.alignItems = 'center';
  divBorderStyle.textAlign = 'center';

  return (
    <div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Stock Trader</label>
        <RunScriptButton
          title="Toggle stock trader script"
          runScriptFunc={handleToggleStockTrader.bind(
            undefined,
            netscript,
            eventListener,
            setFundsLimit,
            uiTheme
          )}
          scriptAlreadyRunning={traderRunning}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
      </div>
      <label style={getLabelStyle('center')}>Trading Settings</label>
      <div style={divBorderStyle}>
        <ToggleButton
          id={SHORT_SALES_BUTTON_ID}
          onClick={handleTradeSettingsClick}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Short Sales
        </ToggleButton>
        <ToggleButton
          id={PURCHASE_STOCKS_BUTTON_ID}
          onClick={handleTradeSettingsClick}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Purchase Stocks
        </ToggleButton>
      </div>
      <div style={divBorderStyle}>
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

export {StocksTraderUI};
