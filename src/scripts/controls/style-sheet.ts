import {IStyleSettings, UserInterfaceTheme} from '@ns';

type Globals =
  | '-moz-initial'
  | 'inherit'
  | 'initial'
  | 'revert'
  | 'revert-layer'
  | 'unset';
type TextAlign =
  | Globals
  | 'center'
  | 'end'
  | 'justify'
  | 'left'
  | 'match-parent'
  | 'right'
  | 'start';

const TOGGLE_BUTTON_SELECTED_CLASS = 'toggle-button-selected';

const PLAY_ICON_SVG_PATH =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.5 16.5v-9l7 4.5-7 4.5z';
const STOP_ICON_SVG_PATH =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 14H8V8h8v8z';

function getHeaderDivStyle(
  uiStyle: IStyleSettings,
  uiTheme: UserInterfaceTheme
): React.CSSProperties {
  return {
    fontFamily: uiStyle.fontFamily,
    lineHeight: uiStyle.lineHeight,

    color: uiTheme.primary,
    backgroundColor: uiTheme.backgroundprimary,

    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };
}

function getHeaderLabelStyle(): React.CSSProperties {
  return {
    textAlign: 'center',
    fontSize: '14pt',
    margin: 'auto',
  };
}

function getDivBorderStyle(
  uiStyle: IStyleSettings,
  uiTheme: UserInterfaceTheme,
  textAlign: TextAlign = 'left'
): React.CSSProperties {
  return {
    fontFamily: uiStyle.fontFamily,
    lineHeight: uiStyle.lineHeight,

    color: uiTheme.primary,
    backgroundColor: uiTheme.backgroundprimary,

    textAlign: textAlign,
    padding: '8px',
    opacity: 1,
    borderRadius: '0px',
    border: '1px solid rgb(68, 68, 68)',
    boxShadow:
      'rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px',
  };
}

function getLabelStyle(
  textAlign?: TextAlign,
  fontSize: string | number = '14pt'
): React.CSSProperties {
  return {
    fontSize: fontSize,
    textAlign: textAlign,
    display: 'block',
  };
}

function getInputStyle(
  uiStyle: IStyleSettings,
  uiTheme: UserInterfaceTheme,
  textAlign?: TextAlign,
  fontSize: string | number = '12pt'
): React.CSSProperties {
  return {
    fontFamily: uiStyle.fontFamily,
    lineHeight: uiStyle.lineHeight,

    color: uiTheme.primary,
    backgroundColor: uiTheme.well,

    textAlign: textAlign,
    fontSize: fontSize,

    userSelect: 'text',
    display: 'block',
    boxSizing: 'content-box',
    height: '1.4375em',
    width: '100%',
    minWidth: '0px',

    padding: '4px 0px 5px',
    border: '0px',
    margin: '0px',
  };
}

function getButtonStyle(
  uiStyle: IStyleSettings,
  uiTheme: UserInterfaceTheme
): React.CSSProperties {
  return {
    fontFamily: uiStyle.fontFamily,
    lineHeight: uiStyle.lineHeight,

    color: uiTheme.primary,
    backgroundColor: uiTheme.button,

    cursor: 'pointer',
    position: 'relative',
    boxSizing: 'border-box',

    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',

    fontWeight: 500,
    fontSize: '0.875rem',
    minWidth: '64px',
    padding: '6px 8px',
    outline: '0px',
    margin: '8px 0px',
    borderRadius: '0px',
    border: '1px solid rgb(34, 34, 34)',
  };
}

function getToggleButtonStyle(
  uiStyle: IStyleSettings,
  uiTheme: UserInterfaceTheme
): React.CSSProperties {
  return {
    fontFamily: uiStyle.fontFamily,
    lineHeight: uiStyle.lineHeight,

    color: uiTheme.secondary,
    backgroundColor: uiTheme.backgroundprimary,

    cursor: 'pointer',
    position: 'relative',
    boxSizing: 'border-box',

    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',

    fontWeight: 500,
    fontSize: '0.875rem',
    minWidth: '90px',
    minHeight: '48px',
    padding: '12px 16px',
    outline: '0px',
    margin: '3px',
    borderRadius: '0px',
    border: '1px solid rgb(34, 34, 34)',
  };
}

function getExclusiveToggleButtonStyle(
  uiStyle: IStyleSettings,
  uiTheme: UserInterfaceTheme,
  selected?: boolean
): React.CSSProperties {
  const toggleButtonStyle = getToggleButtonStyle(uiStyle, uiTheme);
  if (selected) {
    toggleButtonStyle.color = uiTheme.primary;
    toggleButtonStyle.backgroundColor = uiTheme.button;
  }

  return toggleButtonStyle;
}

function getSvgButtonStyle(
  uiStyle: IStyleSettings,
  uiTheme: UserInterfaceTheme
): React.CSSProperties {
  return {
    fontFamily: uiStyle.fontFamily,
    lineHeight: uiStyle.lineHeight,

    color: uiTheme.primary,
    backgroundColor: 'transparent',

    cursor: 'pointer',
    position: 'relative',
    boxSizing: 'border-box',

    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',

    padding: 0,
    borderColor: uiTheme.secondary,
    borderStyle: 'solid',
    borderWidth: '0 0 0 1px',
    borderRadius: 0,
    border: '0px',

    marginRight: '5px',
    outline: '0px',
    overflow: 'visible',
  };
}

function getSvgStyle(): React.CSSProperties {
  return {
    userSelect: 'none',
    width: '1em',
    height: '1em',
    display: 'inline-block',
    verticalAlign: 'middle',
    fill: 'currentcolor',
    fontSize: '1.5rem',
  };
}

function getSelectStyle(
  uiStyle: IStyleSettings,
  uiTheme: UserInterfaceTheme
): React.CSSProperties {
  return {
    fontFamily: uiStyle.fontFamily,
    lineHeight: uiStyle.lineHeight,

    color: uiTheme.primary,
    backgroundColor: uiTheme.well,

    userSelect: 'none',
    cursor: 'pointer',
    position: 'relative',
    boxSizing: 'content-box',

    height: '1.4375em',

    fontWeight: 500,
    fontSize: '1rem',

    border: '0px',
    borderRadius: '0px',
    padding: '4px 0px 5px',
    margin: '2.5px',
  };
}

function getOptionStyle(
  uiTheme: UserInterfaceTheme,
  selected?: boolean
): React.CSSProperties {
  return {
    backgroundColor: selected ? uiTheme.primarydark : uiTheme.backgroundprimary,
  };
}

export {
  Globals,
  TextAlign,
  TOGGLE_BUTTON_SELECTED_CLASS,
  PLAY_ICON_SVG_PATH,
  STOP_ICON_SVG_PATH,
  getHeaderDivStyle,
  getHeaderLabelStyle,
  getDivBorderStyle,
  getLabelStyle,
  getInputStyle,
  getButtonStyle,
  getToggleButtonStyle,
  getExclusiveToggleButtonStyle,
  getSvgButtonStyle,
  getSvgStyle,
  getSelectStyle,
  getOptionStyle,
};
