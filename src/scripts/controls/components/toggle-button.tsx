import {IStyleSettings, UserInterfaceTheme} from '@ns';

import {getReactModel} from '/scripts/workflows/ui';

import {
  TOGGLE_BUTTON_SELECTED_CLASS,
  getToggleButtonStyle,
} from '/scripts/controls/style-sheet';

const React = getReactModel().reactNS;

type ToggleButtonOnClickBeforeCallback = (
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) => boolean;
type ToggleButtonOnClickCallback = (
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) => boolean;

function toggleButtonState(
  onClickBeforeCallback: ToggleButtonOnClickBeforeCallback | undefined,
  onClickCallback: ToggleButtonOnClickCallback | undefined,
  uiTheme: UserInterfaceTheme,
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  if (onClickBeforeCallback && !onClickBeforeCallback(eventData)) {
    return;
  }

  const target = eventData.currentTarget;
  const targetClassList = target.classList;
  if (targetClassList.contains(TOGGLE_BUTTON_SELECTED_CLASS)) {
    targetClassList.remove(TOGGLE_BUTTON_SELECTED_CLASS);

    target.style.color = uiTheme.secondary;
    target.style.backgroundColor = uiTheme.backgroundprimary;
  } else {
    targetClassList.add(TOGGLE_BUTTON_SELECTED_CLASS);

    target.style.color = uiTheme.primary;
    target.style.backgroundColor = uiTheme.button;
  }

  if (onClickCallback) {
    onClickCallback(eventData);
  }
}

function ToggleButton({
  id,
  onClickBefore,
  onClick,
  children,
  uiStyle,
  uiTheme,
}: {
  id?: string;
  onClickBefore?: ToggleButtonOnClickBeforeCallback;
  onClick?: ToggleButtonOnClickCallback;
  children?: React.ReactNode;
  uiStyle: IStyleSettings;
  uiTheme: UserInterfaceTheme;
}) {
  return (
    <button
      id={id}
      onClick={toggleButtonState.bind(
        undefined,
        onClickBefore,
        onClick,
        uiTheme
      )}
      style={getToggleButtonStyle(uiStyle, uiTheme)}
    >
      {children}
    </button>
  );
}

export {
  ToggleButtonOnClickBeforeCallback,
  ToggleButtonOnClickCallback,
  ToggleButton,
};
