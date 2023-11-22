import {UserInterfaceTheme} from '@ns';

import {
  BUTTON_CSS_CLASS,
  DIV_BORDER_CSS_CLASS,
  ReactSetStateFunction,
  TEXTBOX_CSS_CLASS,
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
  getDocument,
  getReactModel,
} from '/scripts/workflows/ui';

import {useEffectOnce} from '/scripts/ui/hooks/use-effect-once';

import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {StocksTraderConfigResponse} from '/scripts/comms/responses/stocks-trader-config-response';
import {StocksTraderConfigRequest} from '/scripts/comms/requests/stocks-trader-config-request';
import {StocksTraderConfigEvent} from '/scripts/comms/events/stocks-trader-config-event';

import {StocksTraderConfig} from '/scripts/workflows/stocks';

interface InterfaceControls {
  shortSales: HTMLElement | null;
  purchaseStocks: HTMLElement | null;
  fundsLimit: HTMLElement | null;
}

const React = getReactModel().reactNS;
const useState = React.useState;

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '14pt',
  textAlign: 'center',
  display: 'block',
};
const DIV_STYLE: React.CSSProperties = {
  alignItems: 'center',
  textAlign: 'center',
};

const SHORT_SALES_BUTTON_ID = 'shortSales';
const PURCHASE_STOCKS_BUTTON_ID = 'purchaseStocks';
const FUNDS_LIMIT_TEXTBOX_ID = 'fundsLimit';
const SET_FUNDS_LIMIT_BUTTON_ID = 'setFundsLimit';

function getIntefaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    shortSales: doc.getElementById(SHORT_SALES_BUTTON_ID),
    purchaseStocks: doc.getElementById(PURCHASE_STOCKS_BUTTON_ID),
    fundsLimit: doc.getElementById(FUNDS_LIMIT_TEXTBOX_ID),
  };
  return result;
}

function handleStocksTraderConfigResponse(
  responseData: StocksTraderConfigResponse,
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

  const interfaceControls = getIntefaceControls();
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
  setFundsLimit(config.fundsLimit.toString());
}

function handleTradeSettingsClick(
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  const targetClassList = eventData.currentTarget.classList;
  if (targetClassList.contains(TOGGLE_BUTTON_SELECTED_CSS_CLASS)) {
    targetClassList.remove(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  } else {
    targetClassList.add(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  }

  sendStockTraderConfig();
}

function handleSetFundsLimitClick(
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  const interfaceControls = getIntefaceControls();
  const fundsLimitValue = interfaceControls.fundsLimit?.innerText;
  if (!fundsLimitValue || isNaN(parseInt(fundsLimitValue))) {
    return;
  }

  sendStockTraderConfig();
}

function sendStockTraderConfig() {
  const interfaceControls = getIntefaceControls();

  let fundsLimit = parseInt(interfaceControls.fundsLimit?.innerText ?? '');
  if (isNaN(fundsLimit)) {
    fundsLimit = 0;
  }
  const traderConfig: StocksTraderConfig = {
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
  sendMessage(new StocksTraderConfigEvent(traderConfig));
}

function StocksTraderUI({
  uiTheme,
  eventListener,
}: {
  uiTheme: UserInterfaceTheme;
  eventListener: EventListener;
}) {
  const [fundsLimit, setFundsLimit] = useState('');

  useEffectOnce(() => {
    eventListener.addListener(
      StocksTraderConfigResponse,
      handleStocksTraderConfigResponse,
      eventListener,
      setFundsLimit
    );
    sendMessage(new StocksTraderConfigRequest(eventListener.subscriberName));
  });

  return (
    <div>
      <label color={uiTheme.info} style={LABEL_STYLE}>
        Trading Settings
      </label>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <button
          id={SHORT_SALES_BUTTON_ID}
          className={TOGGLE_BUTTON_CSS_CLASS}
          onClick={handleTradeSettingsClick}
        >
          Short Sales
        </button>
        <button
          id={PURCHASE_STOCKS_BUTTON_ID}
          className={TOGGLE_BUTTON_CSS_CLASS}
          onClick={handleTradeSettingsClick}
        >
          Purchase Stocks
        </button>
      </div>
      <div className={DIV_BORDER_CSS_CLASS} style={DIV_STYLE}>
        <input
          id={FUNDS_LIMIT_TEXTBOX_ID}
          className={TEXTBOX_CSS_CLASS}
          placeholder="Enter funds limit"
        >
          {fundsLimit}
        </input>
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
