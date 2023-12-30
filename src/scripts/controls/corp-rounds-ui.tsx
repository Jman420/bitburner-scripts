import {NS} from '@ns';

import {getReactModel} from '/scripts/workflows/ui';

import {
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {Button} from '/scripts/controls/components/button';

import {runScript} from '/scripts/workflows/execution';
import {
  CORP_PUBLIC_SCRIPT,
  CORP_ROUND1_SCRIPT,
  CORP_ROUND2_SCRIPT,
  CORP_ROUND3_SCRIPT,
  CORP_ROUND4_SCRIPT,
} from '/scripts/workflows/corporation-shared';

const React = getReactModel().reactNS;

function runRound1Script(netscript: NS) {
  runScript(netscript, CORP_ROUND1_SCRIPT);
}

function runRound2Script(netscript: NS) {
  runScript(netscript, CORP_ROUND2_SCRIPT);
}

function runRound3Script(netscript: NS) {
  runScript(netscript, CORP_ROUND3_SCRIPT);
}

function runRound4Script(netscript: NS) {
  runScript(netscript, CORP_ROUND4_SCRIPT);
}

function runPublicScript(netscript: NS) {
  runScript(netscript, CORP_PUBLIC_SCRIPT);
}

function CorpRoundsUI({netscript}: {netscript: NS}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  return (
    <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Corporation Automation</label>
      </div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <Button
          onClick={runRound1Script.bind(undefined, netscript)}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Round 1
        </Button>
        <Button
          onClick={runRound2Script.bind(undefined, netscript)}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Round 2
        </Button>
        <Button
          onClick={runRound3Script.bind(undefined, netscript)}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Round 3
        </Button>
        <Button
          onClick={runRound4Script.bind(undefined, netscript)}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Round 4
        </Button>
        <Button
          onClick={runPublicScript.bind(undefined, netscript)}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Public
        </Button>
      </div>
    </div>
  );
}

export {CorpRoundsUI};
