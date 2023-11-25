import {
  ReactSetStateFunction,
  getReactModel,
  handleDisableTerminal,
  handleEnableTerminal,
  handleTextboxInputChange,
} from '/scripts/workflows/ui';

import {
  COLOR_DARK_GRAY,
  COLOR_GREEN,
  TEXTBOX_CSS_CLASS,
} from '/scripts/controls/style-sheet';

const React = getReactModel().reactNS;

function LabeledTextbox({
  id,
  title,
  placeholder,
  value,
  setValueFunc,
}: {
  id: string;
  title?: string;
  placeholder?: string;
  value?: string;
  setValueFunc: ReactSetStateFunction<string>;
}) {
  return (
    <div style={{color: COLOR_GREEN, margin: '4px'}}>
      <label style={{fontSize: '14px', textAlign: 'left'}}>{title}</label>
      <input
        style={{
          fontSize: '16px',
          textAlign: 'center',
          backgroundColor: COLOR_DARK_GRAY,
        }}
        id={id}
        className={TEXTBOX_CSS_CLASS}
        placeholder={placeholder}
        value={value}
        onFocusCapture={handleDisableTerminal}
        onBlur={handleEnableTerminal}
        onChange={handleTextboxInputChange.bind(undefined, setValueFunc)}
      />
    </div>
  );
}

export {LabeledTextbox};
