import {MouseEventHandler} from 'react';
import {
  PLAY_ICON_SVG_PATH,
  ReactSetStateFunction,
  STOP_ICON_SVG_PATH,
  SVG_BUTTON_CSS_CLASS,
  SVG_PLAY_ICON_CSS_CLASS,
  SVG_STOP_ICON_CSS_CLASS,
  getReactModel,
} from '/scripts/workflows/ui';

type RunScriptFunction = (scriptRunning: boolean) => void;

const React = getReactModel().reactNS;
const useState = React.useState;

function handleButtonClick(
  setIconClassName: ReactSetStateFunction<string>,
  setIconSvgPath: ReactSetStateFunction<string>,
  callback: RunScriptFunction,
  eventData: React.MouseEvent<SVGSVGElement, MouseEvent>
) {
  const iconSvg = eventData.currentTarget;

  let scriptRunning = false;
  const svgClassName = iconSvg.classList.value;
  if (svgClassName === SVG_PLAY_ICON_CSS_CLASS) {
    setIconClassName(SVG_STOP_ICON_CSS_CLASS);
    setIconSvgPath(STOP_ICON_SVG_PATH);
    scriptRunning = false;
  } else if (svgClassName === SVG_STOP_ICON_CSS_CLASS) {
    setIconClassName(SVG_PLAY_ICON_CSS_CLASS);
    setIconSvgPath(PLAY_ICON_SVG_PATH);
    scriptRunning = true;
  }

  if (callback) {
    callback(scriptRunning);
  }
}

function RunScriptButton({
  title,
  runScriptFunc,
}: {
  title?: string;
  runScriptFunc: RunScriptFunction;
}) {
  const [iconClassName, setIconClassName] = useState(SVG_PLAY_ICON_CSS_CLASS);
  const [iconSvgPath, setIconSvgPath] = useState(PLAY_ICON_SVG_PATH);

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
