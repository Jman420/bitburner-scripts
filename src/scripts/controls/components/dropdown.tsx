import {IStyleSettings, UserInterfaceTheme} from '@ns';

import {getReactModel} from '/scripts/workflows/ui';
import {getLabelStyle, getSelectStyle} from '/scripts/controls/style-sheet';

const React = getReactModel().reactNS;

interface DropdownOption {
  label: string;
  value: string;
}

function Dropdown({
  id,
  title,
  options,
  uiStyle,
  uiTheme,
}: {
  id: string;
  title?: string;
  options: DropdownOption[];
  uiStyle: IStyleSettings;
  uiTheme: UserInterfaceTheme;
}) {
  return (
    <div style={{color: uiTheme.primary, margin: '4px'}}>
      <label style={getLabelStyle('left', '10pt')}>{title}</label>
      <select id={id} style={getSelectStyle(uiStyle, uiTheme)}>
        {options.map(dropdownOption => (
          <option value={dropdownOption.value}>{dropdownOption.label}</option>
        ))}
      </select>
    </div>
  );
}

export {DropdownOption, Dropdown};
