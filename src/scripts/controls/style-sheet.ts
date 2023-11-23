// NOTE : These values are pulled from the Game's Debug Console ; the css-****** values on the end apply themed styling and seem to be randomly generated at compile time, but are consistent between game executions.
//   However, the source controls using the css class needs to be loaded by the game before the style will be applied to our controls... cause we are hijacking the game's style sheet without hooking into the style framework (MaterialUI?)
const DIV_BORDER_CSS_CLASS = 'css-tlze81';
const DIV_INPUT_CSS_CLASS = 'css-16jk9b1';
const BUTTON_CSS_CLASS = 'css-13ak5e0';
const TOGGLE_BUTTON_CSS_CLASS = 'css-1k9ietj';
const TOGGLE_BUTTON_SELECTED_CSS_CLASS = 'Mui-selected';
const TEXTBOX_CSS_CLASS = 'css-1oaunmp';
const SVG_BUTTON_CSS_CLASS = 'css-jhk36g';
const SVG_PLAY_ICON_CSS_CLASS = 'css-vubbuv';
const SVG_STOP_ICON_CSS_CLASS = 'css-ahfcdp';

const PLAY_ICON_SVG_PATH =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.5 16.5v-9l7 4.5-7 4.5z';
const STOP_ICON_SVG_PATH =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 14H8V8h8v8z';

const HEADER_DIV_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const HEADER_LABEL_STYLE: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '14pt',
  margin: 'auto',
};

export {
  DIV_BORDER_CSS_CLASS,
  DIV_INPUT_CSS_CLASS,
  BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
  TEXTBOX_CSS_CLASS,
  SVG_BUTTON_CSS_CLASS,
  SVG_PLAY_ICON_CSS_CLASS,
  SVG_STOP_ICON_CSS_CLASS,
  PLAY_ICON_SVG_PATH,
  STOP_ICON_SVG_PATH,
  HEADER_DIV_STYLE,
  HEADER_LABEL_STYLE,
};
