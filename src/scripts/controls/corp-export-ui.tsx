import {NS} from '@ns';

import {getDocument, getReactModel} from '/scripts/workflows/ui';

import {
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {Dropdown} from '/scripts/controls/components/dropdown';
import {
  EXPORT_SETUP_SCRIPT,
  getDivisions,
} from '/scripts/workflows/corporation';
import {Button} from '/scripts/controls/components/button';
import {getCmdFlag} from '/scripts/workflows/cmd-args';
import {CMD_FLAG_DIVISION_NAME} from '/scripts/corp-export';
import {runScript} from '/scripts/workflows/execution';

interface InterfaceControls {
  divisionName?: HTMLSelectElement;
}

const React = getReactModel().reactNS;

const DIVISION_NAME_ID = 'exportSetup-divisionName';

function getInterfaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    divisionName: doc.getElementById(DIVISION_NAME_ID) as
      | HTMLSelectElement
      | undefined,
  };
  return result;
}

function runManagerScript(netscript: NS) {
  const interfaceControls = getInterfaceControls();

  if (!interfaceControls.divisionName?.value) {
    return;
  }

  const divisionName = interfaceControls.divisionName.value;
  const scriptArgs = [getCmdFlag(CMD_FLAG_DIVISION_NAME), divisionName];
  runScript(netscript, EXPORT_SETUP_SCRIPT, undefined, 1, false, ...scriptArgs);
}

function CorpExportUI({netscript}: {netscript: NS}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const divisionNames = getDivisions(netscript);

  return (
    <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Export Setup</label>
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
        <Button
          style={{marginTop: '25px'}}
          onClick={runManagerScript.bind(undefined, netscript)}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        >
          Run
        </Button>
      </div>
    </div>
  );
}

export {CorpExportUI};
