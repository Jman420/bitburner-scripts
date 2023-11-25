const COLOR_GREEN = 'rgb(0, 204, 0)';
const COLOR_DARK_GRAY = 'rgb(34, 34, 34)';
const COLOR_LIGHT_GRAY = 'rgb(136, 136, 136)';
const COLOR_BLACK = 'rgb(0, 0, 0, 0.87)';
const COLOR_WHITE = 'rgb(255, 255, 255)';

const DEFAULT_FONT_FAMILY =
  '"Lucida Console", "Lucida Sans Unicode", "Fira Mono", Consolas, "Courier New", Courier, monospace, "Times New Roman"';

// NOTE : These values are pulled from the Game's Debug Console ; the css-****** values on the end apply themed styling and seem to be randomly generated at compile time, but are consistent between game executions.
//   However, the source controls using the css class needs to be loaded by the game before the style will be applied to our controls... cause we are hijacking the game's style sheet without hooking into the style framework (MaterialUI?)
const DIV_BORDER_CSS_CLASS = 'css-tlze81';
const DIV_INPUT_CSS_CLASS = 'css-16jk9b1';
const BUTTON_CSS_CLASS = 'css-13ak5e0';
const TOGGLE_BUTTON_CSS_CLASS = 'css-1k9ietj';
const TEXTBOX_CSS_CLASS = 'css-1oaunmp';
const SVG_BUTTON_CSS_CLASS = 'css-jhk36g';
const SVG_PLAY_ICON_CSS_CLASS = 'css-vubbuv';
const SVG_STOP_ICON_CSS_CLASS = 'css-ahfcdp';

const TOGGLE_BUTTON_SELECTED_CSS_CLASS = 'Mui-selected';

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

const INPUT_DIV_STYLE: React.CSSProperties = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontWeight: 400,
  fontSize: '1rem',
  lineHeight: '1.4375em',
  boxSizing: 'border-box',
  cursor: 'text',
  display: 'inline-flex',
  alignItems: 'center',
  color: COLOR_GREEN,
  position: 'relative',
  backgroundColor: COLOR_DARK_GRAY,
  borderBottomColor: COLOR_WHITE,
};
const INPUT_STYLE: React.CSSProperties = {
  font: 'inherit',
  letterSpacing: 'inherit',
  color: 'currentcolor',
  padding: '4px 0px 5px',
  border: '0px',
  boxSizing: 'content-box',
  background: 'none',
  height: '1.4375em',
  margin: '0px',
  display: 'block',
  minWidth: '0px',
  width: '100%',
  animationName: 'mui-auto-fill-cancel',
  animationDuration: '10ms',
};

export {
  COLOR_BLACK,
  COLOR_DARK_GRAY,
  COLOR_LIGHT_GRAY,
  COLOR_GREEN,
  COLOR_WHITE,
  DEFAULT_FONT_FAMILY,
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
  INPUT_DIV_STYLE,
  INPUT_STYLE,
};
