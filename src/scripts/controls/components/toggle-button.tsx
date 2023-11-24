import {getReactModel} from '/scripts/workflows/ui';

import {
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
} from '/scripts/controls/style-sheet';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';

const React = getReactModel().reactNS;

type ToggleButtonOnClickCallback = (
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) => void;

let onClickCallback: ToggleButtonOnClickCallback | undefined;

function toggleButtonState(
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
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
  onClick,
  children,
}: {
  id?: string;
  onClick?: ToggleButtonOnClickCallback;
  children: React.ReactNode;
}) {
  useEffectOnce(() => {
    onClickCallback = onClick;
  });

  return (
    <button
      id={id}
      className={TOGGLE_BUTTON_CSS_CLASS}
      onClick={toggleButtonState}
    >
      {children}
    </button>
  );
}

export {ToggleButtonOnClickCallback, ToggleButton};
