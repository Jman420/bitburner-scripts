import {NS, UserInterfaceTheme} from '@ns';

import {Logger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER} from '/scripts/logging/logOutput';

import {EventListener} from '/scripts/comms/event-comms';
import {StocksTickerEvent} from '/scripts/comms/events/stocks-ticker-event';

import {getReactModel, ReactSetStateFunction} from '/scripts/workflows/ui';
import {scanWideNetwork} from '/scripts/workflows/recon';
import {TOTAL_STOCKS} from '/scripts/workflows/stocks';
import {GangInfoChangedEvent} from '/scripts/comms/events/gang-info-changed-event';
import {useInterval} from '/scripts/ui/hooks/use-interval';
import {useEffectOnce} from '/scripts/ui/hooks/use-effect-once';

const React = getReactModel().reactNS;
const useState = React.useState;

function updateStocksMetrics(
  eventData: StocksTickerEvent,
  netscript: NS,
  logWriter: Logger,
  setStocksValue: ReactSetStateFunction<string>,
  setStocksProfit: ReactSetStateFunction<string>
) {
  if (
    !eventData.stockListings ||
    eventData.stockListings.length < TOTAL_STOCKS
  ) {
    return;
  }

  logWriter.writeLine('Calculating stock portfolio metrics...');
  let totalValue = 0;
  let totalProfit = 0;
  for (const stockListing of eventData.stockListings) {
    const longValue = stockListing.position.longShares * stockListing.askPrice;
    const shortValue =
      stockListing.position.shortShares * stockListing.bidPrice;
    totalValue += longValue;
    totalValue += shortValue;

    totalProfit +=
      longValue -
      stockListing.position.longShares * stockListing.position.longPrice;
    totalProfit +=
      shortValue -
      stockListing.position.shortShares * stockListing.position.shortPrice;
  }

  logWriter.writeLine('Updating stock portfolio metrics...');
  setStocksValue(`$${netscript.formatNumber(totalValue)}`);
  setStocksProfit(`$${netscript.formatNumber(totalProfit)}`);
  logWriter.writeLine(ENTRY_DIVIDER);
}

function updateGangMetrics(
  eventData: GangInfoChangedEvent,
  netscript: NS,
  logWriter: Logger,
  setGangIncome: ReactSetStateFunction<string>
) {
  if (!eventData.gangInfo) {
    return;
  }

  logWriter.writeLine('Updating gang metrics...');
  setGangIncome(`$${netscript.formatNumber(eventData.gangInfo.moneyGainRate)}`);
}

function updatePolledMetrics(
  netscript: NS,
  logWriter: Logger,
  setCity: ReactSetStateFunction<string>,
  setLocation: ReactSetStateFunction<string>,
  setScriptsExp: ReactSetStateFunction<string>,
  setScriptsIncome: ReactSetStateFunction<string>
) {
  logWriter.writeLine('Calculating script metrics...');
  let totalScriptIncome = 0;
  let totalScriptExp = 0;
  const rootedHosts = scanWideNetwork(netscript, true, true, true);
  for (const hostname of rootedHosts) {
    const procInfos = netscript.ps(hostname);
    for (const scriptProc of procInfos) {
      const scriptDetails = netscript.getRunningScript(
        scriptProc.pid,
        hostname
      );
      if (scriptDetails) {
        totalScriptIncome +=
          scriptDetails.onlineMoneyMade / scriptDetails.onlineRunningTime;
        totalScriptExp +=
          scriptDetails.onlineExpGained / scriptDetails.onlineRunningTime;
      }
    }
  }

  logWriter.writeLine('Retrieving location & player metrics...');
  const playerInfo = netscript.getPlayer();

  logWriter.writeLine('Updating location & script...');
  setCity(playerInfo.city);
  setLocation(playerInfo.location);
  setScriptsIncome(`$${netscript.formatNumber(totalScriptIncome)}`);
  setScriptsExp(netscript.formatNumber(totalScriptExp));
  logWriter.writeLine(ENTRY_DIVIDER);
}

function CustomHudValues({
  netscript,
  eventListener,
  logWriter,
  updateDelay,
  uiTheme,
  excludeLocationMetrics,
  excludeScriptsMetrics,
  excludeStocksMetrics,
  excludeGangMetrics,
}: {
  netscript: NS;
  eventListener: EventListener;
  logWriter: Logger;
  updateDelay: number | undefined;
  uiTheme: UserInterfaceTheme;
  excludeLocationMetrics: boolean;
  excludeScriptsMetrics: boolean;
  excludeStocksMetrics: boolean;
  excludeGangMetrics: boolean;
}) {
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [scriptsExp, setScriptsExp] = useState('');
  const [scriptsIncome, setScriptsIncome] = useState('');
  const [stocksPortfolioValue, setStocksPortfolioValue] = useState('');
  const [stocksProfit, setStocksProfit] = useState('');
  const [gangIncome, setGangIncome] = useState('');

  useEffectOnce(() => {
    updatePolledMetrics(
      netscript,
      logWriter,
      setCity,
      setLocation,
      setScriptsExp,
      setScriptsIncome
    );
  });
  useInterval(() => {
    updatePolledMetrics(
      netscript,
      logWriter,
      setCity,
      setLocation,
      setScriptsExp,
      setScriptsIncome
    );
  }, updateDelay);

  useEffectOnce(() => {
    eventListener.addListener(
      StocksTickerEvent,
      updateStocksMetrics,
      netscript,
      logWriter,
      setStocksPortfolioValue,
      setStocksProfit
    );
  });
  useEffectOnce(() => {
    eventListener.addListener(
      GangInfoChangedEvent,
      updateGangMetrics,
      netscript,
      logWriter,
      setGangIncome
    );
  });

  return (
    <div>
      <hr />
      <label
        id="cityValue"
        style={{
          color: uiTheme['infolight'],
          display: excludeLocationMetrics ? 'none' : '',
        }}
      >
        {city}
      </label>
      <br style={{display: excludeLocationMetrics ? 'none' : ''}} />
      <label
        id="locationValue"
        style={{
          color: uiTheme['infolight'],
          display: excludeLocationMetrics ? 'none' : '',
        }}
      >
        {location}
      </label>
      <br style={{display: excludeLocationMetrics ? 'none' : ''}} />
      <label
        id="scriptsExpValue"
        style={{
          color: uiTheme['hack'],
          display: excludeScriptsMetrics ? 'none' : '',
        }}
      >
        {scriptsExp}
      </label>
      <br style={{display: excludeScriptsMetrics ? 'none' : ''}} />
      <label
        id="scriptsIncomeValue"
        style={{
          color: uiTheme['money'],
          display: excludeScriptsMetrics ? 'none' : '',
        }}
      >
        {scriptsIncome}
      </label>
      <br style={{display: excludeScriptsMetrics ? 'none' : ''}} />
      <label
        id="stocksPortfolioValue"
        style={{
          color: uiTheme['money'],
          display: excludeStocksMetrics ? 'none' : '',
        }}
      >
        {stocksPortfolioValue}
      </label>
      <br style={{display: excludeStocksMetrics ? 'none' : ''}} />
      <label
        id="stocksProfitValue"
        style={{
          color: uiTheme['money'],
          display: excludeStocksMetrics ? 'none' : '',
        }}
      >
        {stocksProfit}
      </label>
      <br style={{display: excludeStocksMetrics ? 'none' : ''}} />
      <label
        id="gangIncomeValue"
        style={{
          color: uiTheme['money'],
          display: excludeGangMetrics ? 'none' : '',
        }}
      >
        {gangIncome}
      </label>
      <br style={{display: excludeGangMetrics ? 'none' : ''}} />
    </div>
  );
}

export {CustomHudValues};