import {IStyleSettings, UserInterfaceTheme} from '@ns';

import {
  getReactModel,
  handleDisableTerminal,
  handleEnableTerminal,
  handleTextboxInputChange,
} from '/scripts/workflows/ui';
import {TextAlign, getInputStyle} from '/scripts/controls/style-sheet';

const React = getReactModel().reactNS;

function Input({
  id,
  placeholder,
  textAlign,
  fontSize,
  value = '',
  setValue,
  uiStyle,
  uiTheme,
}: {
  id?: string;
  placeholder?: string;
  textAlign?: TextAlign;
  fontSize?: string | number;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  uiStyle: IStyleSettings;
  uiTheme: UserInterfaceTheme;
}) {
  return (
    <input
      id={id}
      style={getInputStyle(uiStyle, uiTheme, textAlign, fontSize)}
      placeholder={placeholder}
      value={value}
      onFocusCapture={handleDisableTerminal}
      onBlur={handleEnableTerminal}
      onChange={handleTextboxInputChange.bind(undefined, setValue)}
    />
  );
}

export {Input};
