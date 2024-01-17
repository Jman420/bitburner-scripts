import {IStyleSettings, UserInterfaceTheme} from '@ns';

import {ReactSetStateFunction, getReactModel} from '/scripts/workflows/ui';

import {getLabelStyle} from '/scripts/controls/style-sheet';
import {Input} from '/scripts/controls/components/input';

const React = getReactModel().reactNS;

function LabeledInput({
  id,
  title,
  placeholder,
  value,
  setValue,
  uiStyle,
  uiTheme,
}: {
  id: string;
  title?: string;
  placeholder?: string;
  value: string;
  setValue: ReactSetStateFunction<string>;
  uiStyle: IStyleSettings;
  uiTheme: UserInterfaceTheme;
}) {
  return (
    <div style={{color: uiTheme.primary, margin: '4px'}}>
      <label style={getLabelStyle('left', '10pt')}>{title}</label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        setValue={setValue}
        uiStyle={uiStyle}
        uiTheme={uiTheme}
        fontSize="12pt"
      />
    </div>
  );
}

export {LabeledInput};
