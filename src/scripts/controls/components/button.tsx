import {IStyleSettings, UserInterfaceTheme} from '@ns';

import {getReactModel} from '/scripts/workflows/ui';
import {getButtonStyle} from '/scripts/controls/style-sheet';

const React = getReactModel().reactNS;

type ButtonOnClickCallback = (
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) => void;

function handleMouseOver(
  uiTheme: UserInterfaceTheme,
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  eventData.currentTarget.style.backgroundColor = uiTheme.backgroundprimary;
}

function handleMouseOut(
  uiTheme: UserInterfaceTheme,
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  eventData.currentTarget.style.backgroundColor = uiTheme.button;
}

function Button({
  id,
  onClick,
  children,
  style,
  uiStyle,
  uiTheme,
}: {
  id?: string;
  onClick?: ButtonOnClickCallback;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  uiStyle: IStyleSettings;
  uiTheme: UserInterfaceTheme;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      style={Object.assign(getButtonStyle(uiStyle, uiTheme), style)}
      onMouseOver={handleMouseOver.bind(undefined, uiTheme)}
      onMouseOut={handleMouseOut.bind(undefined, uiTheme)}
    >
      {children}
    </button>
  );
}

export {ButtonOnClickCallback, Button};
