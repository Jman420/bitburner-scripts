import {getReactModel} from '/scripts/workflows/ui';

import {
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
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
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  if (onClickBeforeCallback && !onClickBeforeCallback(eventData)) {
    return;
  }

  const targetClassList = eventData.currentTarget.classList;
  if (targetClassList.contains(TOGGLE_BUTTON_SELECTED_CSS_CLASS)) {
    targetClassList.remove(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  } else {
    targetClassList.add(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
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
}: {
  id?: string;
  onClickBefore?: ToggleButtonOnClickBeforeCallback;
  onClick?: ToggleButtonOnClickCallback;
  children?: React.ReactNode;
}) {
  return (
    <button
      id={id}
      className={TOGGLE_BUTTON_CSS_CLASS}
      onClick={toggleButtonState.bind(undefined, onClickBefore, onClick)}
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
