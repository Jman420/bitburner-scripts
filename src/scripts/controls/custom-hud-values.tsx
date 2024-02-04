import {NS} from '@ns';

import {Logger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER} from '/scripts/logging/logOutput';

import {EventListener} from '/scripts/comms/event-comms';
import {StocksTickerEvent} from '/scripts/comms/events/stocks-ticker-event';
import {GangInfoChangedEvent} from '/scripts/comms/events/gang-info-changed-event';

import {useInterval} from '/scripts/controls/hooks/use-interval';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

import {getReactModel, ReactSetStateFunction} from '/scripts/workflows/ui';
import {scanWideNetwork} from '/scripts/workflows/recon';
import {getPortfolioValue, TOTAL_STOCKS} from '/scripts/workflows/stocks';
import {
  NetscriptExtended,
  NetscriptPackage,
} from '/scripts/netscript-services/netscript-locator';
import {getPlayerTotalValue} from '/scripts/workflows/player';

const React = getReactModel().reactNS;
const useState = React.useState;

async function updateStocksMetrics(
  eventData: StocksTickerEvent,
  nsPackage: NetscriptPackage,
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

  const netscript = nsPackage.netscript;

  logWriter.writeLine('Calculating stock portfolio metrics...');
  const portfolioMetrics = await getPortfolioValue(nsPackage);

  logWriter.writeLine('Updating stock portfolio metrics...');
  setStocksValue(`$${netscript.formatNumber(portfolioMetrics.totalValue)}`);
  setStocksProfit(`$${netscript.formatNumber(portfolioMetrics.totalProfit)}`);
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

async function updatePolledMetrics(
  nsPackage: NetscriptPackage,
  logWriter: Logger,
  setCity: ReactSetStateFunction<string>,
  setScriptsExp: ReactSetStateFunction<string>,
  setScriptsIncome: ReactSetStateFunction<string>,
  setCorpIncome: ReactSetStateFunction<string>,
  setKarmaLevel: ReactSetStateFunction<string>,
  setPlayerTotalValue: ReactSetStateFunction<string>
) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;
  const netscriptExtended = netscript as NetscriptExtended;

  logWriter.writeLine('Calculating script metrics...');
  let totalScriptIncome = 0;
  let totalScriptExp = 0;
  const rootedHosts = scanWideNetwork(netscript, {
    includeHome: true,
    rootOnly: true,
    requireRam: true,
  });
  for (const hostname of rootedHosts) {
    const procInfos = await nsLocator['ps'](hostname);
    for (const scriptProc of procInfos) {
      const scriptDetails = await nsLocator['getRunningScript'](
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
  setScriptsExp(netscript.formatNumber(totalScriptExp));
  setScriptsIncome(`$${netscript.formatNumber(totalScriptIncome)}`);

  const corpApi = nsLocator.corporation;
  if (await corpApi['hasCorporation']()) {
    logWriter.writeLine('Retrieving corporation metrics...');
    const corpInfo = await corpApi['getCorporation']();
    setCorpIncome(`$${netscript.formatNumber(corpInfo.dividendEarnings)}`);
  } else {
    setCorpIncome(`$${netscript.formatNumber(0)}`);
  }

  logWriter.writeLine('Retrieving location & player metrics...');
  const playerInfo = netscript.getPlayer();
  const karmaLevel = netscriptExtended.heart.break();
  setCity(playerInfo.city);
  setKarmaLevel(netscript.formatNumber(karmaLevel));

  logWriter.writeLine('Updating Total Player Value...');
  setPlayerTotalValue(
    `$${netscript.formatNumber(await getPlayerTotalValue(nsPackage))}`
  );

  logWriter.writeLine(ENTRY_DIVIDER);
}

function CustomHudValues({
  nsPackage,
  eventListener,
  logWriter,
  updateDelay,
  excludeLocationMetrics,
  excludeScriptsMetrics,
  excludeGangMetrics,
  excludeCorpMetrics,
  excludeStocksMetrics,
  excludePlayerMetrics,
}: {
  nsPackage: NetscriptPackage;
  eventListener: EventListener;
  logWriter: Logger;
  updateDelay: number | undefined;
  excludeLocationMetrics: boolean;
  excludeScriptsMetrics: boolean;
  excludeGangMetrics: boolean;
  excludeCorpMetrics: boolean;
  excludeStocksMetrics: boolean;
  excludePlayerMetrics: boolean;
}) {
  const netscript = nsPackage.netscript;
  const uiTheme = netscript.ui.getTheme();

  const [city, setCity] = useState('');
  const [scriptsExp, setScriptsExp] = useState('');
  const [scriptsIncome, setScriptsIncome] = useState('');
  const [gangIncome, setGangIncome] = useState('');
  const [corpIncome, setCorpIncome] = useState('');
  const [stocksProfit, setStocksProfit] = useState('');
  const [stocksPortfolioValue, setStocksPortfolioValue] = useState('');
  const [playerTotalValue, setPlayerTotalValue] = useState('');
  const [playerKarmaLevel, setKarmaLevel] = useState('');

  useEffectOnce(() => {
    updatePolledMetrics(
      nsPackage,
      logWriter,
      setCity,
      setScriptsExp,
      setScriptsIncome,
      setCorpIncome,
      setKarmaLevel,
      setPlayerTotalValue
    );
  });
  useInterval(() => {
    updatePolledMetrics(
      nsPackage,
      logWriter,
      setCity,
      setScriptsExp,
      setScriptsIncome,
      setCorpIncome,
      setKarmaLevel,
      setPlayerTotalValue
    );
  }, updateDelay);

  useEffectOnce(() => {
    eventListener.addListener(
      StocksTickerEvent,
      updateStocksMetrics,
      nsPackage,
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
          color: uiTheme.infolight,
          display: excludeLocationMetrics ? 'none' : '',
        }}
      >
        {city}
      </label>
      <br style={{display: excludeLocationMetrics ? 'none' : ''}} />
      <label
        id="scriptsExpValue"
        style={{
          color: uiTheme.hack,
          display: excludeScriptsMetrics ? 'none' : '',
        }}
      >
        {scriptsExp}
      </label>
      <br style={{display: excludeScriptsMetrics ? 'none' : ''}} />
      <label
        id="scriptsIncomeValue"
        style={{
          color: uiTheme.money,
          display: excludeScriptsMetrics ? 'none' : '',
        }}
      >
        {scriptsIncome}
      </label>
      <br style={{display: excludeScriptsMetrics ? 'none' : ''}} />
      <label
        id="gangIncomeValue"
        style={{
          color: uiTheme.money,
          display: excludeGangMetrics ? 'none' : '',
        }}
      >
        {gangIncome}
      </label>
      <br style={{display: excludeGangMetrics ? 'none' : ''}} />
      <label
        id="corpIncomeValue"
        style={{
          color: uiTheme.money,
          display: excludeCorpMetrics ? 'none' : '',
        }}
      >
        {corpIncome}
      </label>
      <br style={{display: excludeCorpMetrics ? 'none' : ''}} />
      <label
        id="stocksProfitValue"
        style={{
          color: uiTheme.money,
          display: excludeStocksMetrics ? 'none' : '',
        }}
      >
        {stocksProfit}
      </label>
      <br style={{display: excludeStocksMetrics ? 'none' : ''}} />
      <label
        id="stocksPortfolioValue"
        style={{
          color: uiTheme.money,
          display: excludeStocksMetrics ? 'none' : '',
        }}
      >
        {stocksPortfolioValue}
      </label>
      <br style={{display: excludeStocksMetrics ? 'none' : ''}} />
      <label
        id="playerTotalValue"
        style={{
          color: uiTheme.money,
          display: excludeStocksMetrics ? 'none' : '',
        }}
      >
        {playerTotalValue}
      </label>
      <br style={{display: excludeStocksMetrics ? 'none' : ''}} />
      <label
        id="playerKarmaLevel"
        style={{color: uiTheme.hp, display: excludePlayerMetrics ? 'none' : ''}}
      >
        {playerKarmaLevel}
      </label>
      <br style={{display: excludePlayerMetrics ? 'none' : ''}} />
    </div>
  );
}

export {CustomHudValues};
