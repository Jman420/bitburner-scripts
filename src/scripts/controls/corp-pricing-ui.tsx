import {NS} from '@ns';

import {getReactModel, openTail} from '/scripts/workflows/ui';

import {
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {Button} from '/scripts/controls/components/button';

import {getPid, runScript} from '/scripts/workflows/execution';
import {PRICING_SETUP_SCRIPT} from '/scripts/workflows/corporation-shared';
import {
  TAIL_HEIGHT,
  TAIL_WIDTH,
  TAIL_X_POS,
  TAIL_Y_POS,
} from '/scripts/corp-price';

const React = getReactModel().reactNS;

function runManagerScript(netscript: NS) {
  let managerPID = runScript(netscript, PRICING_SETUP_SCRIPT);
  if (managerPID === -1) {
    managerPID = getPid(netscript, PRICING_SETUP_SCRIPT);
    openTail(
      netscript,
      TAIL_X_POS,
      TAIL_Y_POS,
      TAIL_WIDTH,
      TAIL_HEIGHT,
      managerPID
    );
  }
}

function CorpPricingUI({netscript}: {netscript: NS}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  return (
    <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Pricing Setup</label>
      </div>
      <Button
        style={{marginTop: '25px'}}
        onClick={runManagerScript.bind(undefined, netscript)}
        uiStyle={uiStyle}
        uiTheme={uiTheme}
      >
        Run
      </Button>
    </div>
  );
}

export {CorpPricingUI};
