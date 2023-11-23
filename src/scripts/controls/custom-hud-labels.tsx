import {UserInterfaceTheme} from '@ns';

import {getReactModel} from '/scripts/workflows/ui';

const React = getReactModel().reactNS;

function CustomHudLabels({
  uiTheme,
  excludeLocationMetrics,
  excludeScriptsMetrics,
  excludeGangMetrics,
  excludeStocksMetrics,
  excludePlayerMetrics,
}: {
  uiTheme: UserInterfaceTheme;
  excludeLocationMetrics: boolean;
  excludeScriptsMetrics: boolean;
  excludeGangMetrics: boolean;
  excludeStocksMetrics: boolean;
  excludePlayerMetrics: boolean;
}) {
  return (
    <div>
      <hr />
      <label
        title="Name of the city you are currently in"
        style={{
          color: uiTheme['infolight'],
          display: excludeLocationMetrics ? 'none' : '',
        }}
      >
        City
      </label>
      <br style={{display: excludeLocationMetrics ? 'none' : ''}} />
      <label
        title="Current location witin the city"
        style={{
          color: uiTheme['infolight'],
          display: excludeLocationMetrics ? 'none' : '',
        }}
      >
        Location
      </label>
      <br style={{display: excludeLocationMetrics ? 'none' : ''}} />
      <label
        title="Script hacking experience per second"
        style={{
          color: uiTheme['hack'],
          display: excludeScriptsMetrics ? 'none' : '',
        }}
      >
        Script Exp
      </label>
      <br style={{display: excludeScriptsMetrics ? 'none' : ''}} />
      <label
        title="Script income per second"
        style={{
          color: uiTheme['money'],
          display: excludeScriptsMetrics ? 'none' : '',
        }}
      >
        Script Inc
      </label>
      <br style={{display: excludeScriptsMetrics ? 'none' : ''}} />
      <label
        title="Gang income per second"
        style={{
          color: uiTheme['money'],
          display: excludeGangMetrics ? 'none' : '',
        }}
      >
        Gang Inc
      </label>
      <br style={{display: excludeGangMetrics ? 'none' : ''}} />
      <label
        title="Total profit from stock portfolio"
        style={{
          color: uiTheme['money'],
          display: excludeStocksMetrics ? 'none' : '',
        }}
      >
        Stocks Pft
      </label>
      <br style={{display: excludeStocksMetrics ? 'none' : ''}} />
      <label
        title="Total value of stock portfolio"
        style={{
          color: uiTheme['money'],
          display: excludeStocksMetrics ? 'none' : '',
        }}
      >
        Stocks Val
      </label>
      <br style={{display: excludeStocksMetrics ? 'none' : ''}} />
      <label
        title="Total player money"
        style={{
          color: uiTheme['money'],
          display: excludeStocksMetrics ? 'none' : '',
        }}
      >
        Player Val
      </label>
      <br style={{display: excludePlayerMetrics ? 'none' : ''}} />
    </div>
  );
}

export {CustomHudLabels};
