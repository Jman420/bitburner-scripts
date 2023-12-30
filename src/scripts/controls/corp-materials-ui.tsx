import {NS} from '@ns';

import {getDocument, getReactModel} from '/scripts/workflows/ui';

import {
  getDivBorderStyle,
  getHeaderDivStyle,
  getHeaderLabelStyle,
} from '/scripts/controls/style-sheet';
import {LabeledInput} from '/scripts/controls/components/labeled-input';
import {Dropdown} from '/scripts/controls/components/dropdown';
import {Button} from '/scripts/controls/components/button';

import {getCmdFlag} from '/scripts/workflows/cmd-args';

import {CITY_NAMES} from '/scripts/common/shared';

import {runScript} from '/scripts/workflows/execution';
import {INDUSTRY_MATERIALS_SCRIPT} from '/scripts/workflows/corporation-shared';
import {
  CMD_FLAG_CITY_NAMES,
  CMD_FLAG_DIVISION_NAME,
  CMD_FLAG_STORAGE_SIZE,
} from '/scripts/corp-materials';
import {FRAUD_DIVISION_NAME_PREFIX} from '/scripts/workflows/corporation-shared';

interface InterfaceControls {
  divisionName?: HTMLSelectElement;
  cityName?: HTMLSelectElement;
  storageSize?: HTMLInputElement;
}

const React = getReactModel().reactNS;
const useState = React.useState;

const DIVISION_NAME_ID = 'materials-divisionName';
const CITY_NAME_ID = 'cityName';
const STORAGE_SIZE_ID = 'storageSize';

function getInterfaceControls() {
  const doc = getDocument();
  const result: InterfaceControls = {
    divisionName: doc.getElementById(DIVISION_NAME_ID) as
      | HTMLSelectElement
      | undefined,
    cityName: doc.getElementById(CITY_NAME_ID) as HTMLSelectElement | undefined,
    storageSize: doc.getElementById(STORAGE_SIZE_ID) as
      | HTMLInputElement
      | undefined,
  };
  return result;
}

function runManagerScript(netscript: NS) {
  const interfaceControls = getInterfaceControls();

  if (
    !interfaceControls.divisionName?.value ||
    !interfaceControls.storageSize?.value
  ) {
    return;
  }

  const divisionName = interfaceControls.divisionName.value;
  const cityName = interfaceControls.cityName?.value ?? '';
  const storageSize = interfaceControls.storageSize.value;

  const scriptArgs = [
    getCmdFlag(CMD_FLAG_DIVISION_NAME),
    divisionName,
    getCmdFlag(CMD_FLAG_STORAGE_SIZE),
    storageSize,
  ];
  if (cityName) {
    scriptArgs.push(getCmdFlag(CMD_FLAG_CITY_NAMES));
    scriptArgs.push(cityName);
  }

  runScript(
    netscript,
    INDUSTRY_MATERIALS_SCRIPT,
    undefined,
    1,
    false,
    ...scriptArgs
  );
}

function CorpMaterialsUI({netscript}: {netscript: NS}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();

  const [storageSize, setStorageSize] = useState('');

  const corporationInfo = netscript.corporation.getCorporation();
  const cityNames = ['', ...CITY_NAMES];

  return (
    <div style={getDivBorderStyle(uiStyle, uiTheme, 'center')}>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <label style={getHeaderLabelStyle()}>Industry Materials Manager</label>
      </div>
      <div style={getHeaderDivStyle(uiStyle, uiTheme)}>
        <Dropdown
          id={DIVISION_NAME_ID}
          title="Division"
          options={corporationInfo.divisions
            .filter(value => !value.includes(FRAUD_DIVISION_NAME_PREFIX))
            .map(divisionName => {
              return {label: divisionName, value: divisionName};
            })}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <Dropdown
          id={CITY_NAME_ID}
          title="City"
          options={cityNames.map(cityName => {
            return {label: cityName, value: cityName};
          })}
          uiStyle={uiStyle}
          uiTheme={uiTheme}
        />
        <LabeledInput
          id={STORAGE_SIZE_ID}
          title="Storage Size"
          value={storageSize}
          setValueFunc={setStorageSize}
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

export {CorpMaterialsUI};
