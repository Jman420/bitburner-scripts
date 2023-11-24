import {
  PLAY_ICON_SVG_PATH,
  STOP_ICON_SVG_PATH,
  SVG_BUTTON_CSS_CLASS,
  SVG_PLAY_ICON_CSS_CLASS,
  SVG_STOP_ICON_CSS_CLASS,
} from '/scripts/controls/style-sheet';
import {ReactSetStateFunction, getReactModel} from '/scripts/workflows/ui';

type RunScriptFunction = () => Promise<boolean>;

const React = getReactModel().reactNS;
const useState = React.useState;

async function handleButtonClick(
  setIconClassName: ReactSetStateFunction<string>,
  setIconSvgPath: ReactSetStateFunction<string>,
  callback: RunScriptFunction,
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  eventData: React.MouseEvent<SVGSVGElement, MouseEvent>
) {
  if (callback) {
    const scriptExecuted = await callback();
    if (scriptExecuted) {
      setIconClassName(SVG_STOP_ICON_CSS_CLASS);
      setIconSvgPath(STOP_ICON_SVG_PATH);
    } else {
      setIconClassName(SVG_PLAY_ICON_CSS_CLASS);
      setIconSvgPath(PLAY_ICON_SVG_PATH);
    }
  }
}

function RunScriptButton({
  title,
  runScriptFunc,
  scriptAlreadyRunning,
}: {
  title?: string;
  runScriptFunc: RunScriptFunction;
  scriptAlreadyRunning?: boolean;
}) {
  const [iconClassName, setIconClassName] = useState(
    scriptAlreadyRunning ? SVG_STOP_ICON_CSS_CLASS : SVG_PLAY_ICON_CSS_CLASS
  );
  const [iconSvgPath, setIconSvgPath] = useState(
    scriptAlreadyRunning ? STOP_ICON_SVG_PATH : PLAY_ICON_SVG_PATH
  );

  return (
    <button className={SVG_BUTTON_CSS_CLASS} title={title}>
      <svg
        className={iconClassName}
        style={{textAlign: 'right'}}
        onClick={handleButtonClick.bind(
          undefined,
          setIconClassName,
          setIconSvgPath,
          runScriptFunc
        )}
      >
        <path d={iconSvgPath}></path>
      </svg>
    </button>
  );
}

export {RunScriptFunction, RunScriptButton};
