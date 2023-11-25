import {getDocument, getReactModel} from '/scripts/workflows/ui';

import {
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
} from '/scripts/controls/style-sheet';
import {
  ToggleButtonOnClickBeforeCallback,
  ToggleButtonOnClickCallback,
} from '/scripts/controls/components/toggle-button';

const React = getReactModel().reactNS;

function toggleButtonState(
  exclusiveGroupClass: string,
  onClickBeforeCallback: ToggleButtonOnClickBeforeCallback | undefined,
  onClickCallback: ToggleButtonOnClickCallback | undefined,
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
  if (onClickBeforeCallback && !onClickBeforeCallback(eventData)) {
    return;
  }

  const targetClassList = eventData.currentTarget.classList;
  if (targetClassList.contains(TOGGLE_BUTTON_SELECTED_CSS_CLASS)) {
    return;
  }

  const doc = getDocument();
  const groupElements = doc.getElementsByClassName(exclusiveGroupClass);
  for (const exclusiveElement of groupElements) {
    exclusiveElement.classList.remove(TOGGLE_BUTTON_SELECTED_CSS_CLASS);
  }
  targetClassList.add(TOGGLE_BUTTON_SELECTED_CSS_CLASS);

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
}: {
  id?: string;
  exclusiveGroup: string;
  selected?: boolean;
  onClickBefore?: ToggleButtonOnClickBeforeCallback;
  onClick?: ToggleButtonOnClickCallback;
  children?: React.ReactNode;
}) {
  const selectedClass = selected ? TOGGLE_BUTTON_SELECTED_CSS_CLASS : '';

  return (
    <button
      id={id}
      className={`${TOGGLE_BUTTON_CSS_CLASS} ${exclusiveGroup} ${selectedClass}`}
      onClick={toggleButtonState.bind(
        undefined,
        exclusiveGroup,
        onClickBefore,
        onClick
      )}
    >
      {children}
    </button>
  );
}

export {ExclusiveToggleButton};
