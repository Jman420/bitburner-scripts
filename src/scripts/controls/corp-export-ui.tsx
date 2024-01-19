import {NS} from '@ns';

import {getDocument, getReactModel} from '/scripts/workflows/ui';

import {
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {Dropdown, DropdownOption} from '/scripts/controls/components/dropdown';
import {Button} from '/scripts/controls/components/button';

import {runScript} from '/scripts/workflows/execution';
import {getCmdFlag} from '/scripts/workflows/cmd-args';

import {EXPORT_SETUP_SCRIPT} from '/scripts/workflows/corporation-shared';
import {CMD_FLAG_DIVISION_NAME} from '/scripts/corp-export';
import {FRAUD_DIVISION_NAME_PREFIX} from '/scripts/workflows/corporation-shared';
import {NetscriptPackage} from '/scripts/netscript-services/netscript-locator';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

interface InterfaceControls {
  divisionName?: HTMLSelectElement;
}

const React = getReactModel().reactNS;
const useState = React.useState;

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
  runScript(netscript, EXPORT_SETUP_SCRIPT, {args: scriptArgs});
}

function CorpExportUI({nsPackage}: {nsPackage: NetscriptPackage}) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const [divisionOptions, setDivisionOptions] = useState(
    new Array<DropdownOption>()
  );

  useEffectOnce(() => {
    async function refreshDivisionOptions() {
      const corpInfo = await nsLocator.corporation['getCorporation']();
      const options = corpInfo.divisions
        .filter(value => !value.includes(FRAUD_DIVISION_NAME_PREFIX))
        .map(divisionName => {
          return {label: divisionName, value: divisionName};
        });
      setDivisionOptions(options);
    }
    refreshDivisionOptions();
  });

  return (
    <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Export Setup</label>
      </div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <Dropdown
          id={DIVISION_NAME_ID}
          title="Division"
          options={divisionOptions}
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
