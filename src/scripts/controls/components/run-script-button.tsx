import {IStyleSettings, UserInterfaceTheme} from '@ns';

import {
  PLAY_ICON_SVG_PATH,
  STOP_ICON_SVG_PATH,
  getSvgButtonStyle,
  getSvgStyle,
} from '/scripts/controls/style-sheet';

import {ReactSetStateFunction, getReactModel} from '/scripts/workflows/ui';

type RunScriptFunction = () => Promise<boolean>;

const React = getReactModel().reactNS;
const useState = React.useState;

const STOP_RED = 'rgb(204, 0, 0)';

async function handleButtonClick(
  setIconStyle: ReactSetStateFunction<React.CSSProperties>,
  setIconSvgPath: ReactSetStateFunction<string>,
  callback: RunScriptFunction,
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  eventData: React.MouseEvent<SVGSVGElement, MouseEvent>
) {
  if (callback) {
    const scriptExecuted = await callback();
    const iconStyle = getSvgStyle();
    if (scriptExecuted) {
      iconStyle.color = STOP_RED;
      setIconStyle(iconStyle);
      setIconSvgPath(STOP_ICON_SVG_PATH);
    } else {
      setIconStyle(iconStyle);
      setIconSvgPath(PLAY_ICON_SVG_PATH);
    }
  }
}

function RunScriptButton({
  title,
  scriptAlreadyRunning,
  runScriptFunc,
  uiStyle,
  uiTheme,
}: {
  title?: string;
  scriptAlreadyRunning?: boolean;
  runScriptFunc: RunScriptFunction;
  uiStyle: IStyleSettings;
  uiTheme: UserInterfaceTheme;
}) {
  const initialIconStyle = getSvgStyle();
  if (scriptAlreadyRunning) {
    initialIconStyle.color = STOP_RED;
  }
  const [iconStyle, setIconStyle] = useState(initialIconStyle);
  const [iconSvgPath, setIconSvgPath] = useState(
    scriptAlreadyRunning ? STOP_ICON_SVG_PATH : PLAY_ICON_SVG_PATH
  );

  return (
    <button style={getSvgButtonStyle(uiStyle, uiTheme)} title={title}>
      <svg
        style={iconStyle}
        onClick={handleButtonClick.bind(
          undefined,
          setIconStyle,
          setIconSvgPath,
          runScriptFunc
        )}
      >
        <path d={iconSvgPath} />
      </svg>
    </button>
  );
}

export {RunScriptFunction, RunScriptButton};
