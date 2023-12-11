import {getDocument, getReactModel} from '/scripts/workflows/ui';

import {
  TOGGLE_BUTTON_SELECTED_CLASS,
  getExclusiveToggleButtonStyle,
} from '/scripts/controls/style-sheet';
import {
  ToggleButtonOnClickBeforeCallback,
  ToggleButtonOnClickCallback,
} from '/scripts/controls/components/toggle-button';
import {IStyleSettings, UserInterfaceTheme} from '@ns';

const React = getReactModel().reactNS;

function toggleButtonState(
  exclusiveGroupClass: string,
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
    return;
  }

  const doc = getDocument();
  const groupElements = doc.getElementsByClassName(
    exclusiveGroupClass
  ) as HTMLCollectionOf<HTMLElement>;
  for (const exclusiveElement of groupElements) {
    exclusiveElement.classList.remove(TOGGLE_BUTTON_SELECTED_CLASS);
    exclusiveElement.style.color = uiTheme.secondary;
    exclusiveElement.style.backgroundColor = uiTheme.backgroundprimary;
  }

  targetClassList.add(TOGGLE_BUTTON_SELECTED_CLASS);
  target.style.color = uiTheme.primary;
  target.style.backgroundColor = uiTheme.button;

  if (onClickCallback) {
    onClickCallback(eventData);
  }
}

function ExclusiveToggleButton({
  id,
  exclusiveGroup,
  selected,
  onClickBefore,
  onClick,
  children,
  uiStyle,
  uiTheme,
}: {
  id?: string;
  exclusiveGroup: string;
  selected?: boolean;
  onClickBefore?: ToggleButtonOnClickBeforeCallback;
  onClick?: ToggleButtonOnClickCallback;
  children?: React.ReactNode;
  uiStyle: IStyleSettings;
  uiTheme: UserInterfaceTheme;
}) {
  const selectedClass = selected ? TOGGLE_BUTTON_SELECTED_CLASS : '';

  return (
    <button
      id={id}
      className={`${exclusiveGroup} ${selectedClass}`}
      style={getExclusiveToggleButtonStyle(uiStyle, uiTheme, selected)}
      onClick={toggleButtonState.bind(
        undefined,
        exclusiveGroup,
        onClickBefore,
        onClick,
        uiTheme
      )}
    >
      {children}
    </button>
  );
}

export {ExclusiveToggleButton};
