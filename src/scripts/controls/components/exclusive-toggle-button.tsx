import {getDocument, getReactModel} from '/scripts/workflows/ui';

import {
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
} from '/scripts/controls/style-sheet';
import {useEffectOnce} from '/scripts/controls/hooks/use-effect-once';
import {ToggleButtonOnClickCallback} from '/scripts/controls/components/toggle-button';

const React = getReactModel().reactNS;

let exclusiveGroupClass: string;
let onClickCallback: ToggleButtonOnClickCallback | undefined;

function toggleButtonState(
  eventData: React.MouseEvent<HTMLButtonElement, MouseEvent>
) {
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
  exclusiveGroup,
  id,
  onClick,
  children,
}: {
  exclusiveGroup: string;
  id?: string;
  onClick?: ToggleButtonOnClickCallback;
  children: React.ReactNode;
}) {
  useEffectOnce(() => {
    exclusiveGroupClass = exclusiveGroup;
    onClickCallback = onClick;
  });

  return (
    <button
      id={id}
      className={`${TOGGLE_BUTTON_CSS_CLASS} ${exclusiveGroup}`}
      onClick={toggleButtonState}
    >
      {children}
    </button>
  );
}

export {ExclusiveToggleButton};
