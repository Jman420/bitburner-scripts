/* eslint-disable-next-line node/no-extraneous-import */
import ReactNamespace from 'react/index';
/* eslint-disable-next-line node/no-extraneous-import */
import ReactDomNamespace from 'react-dom';

import {NS} from '@ns';

interface ReactModel {
  reactDOM: typeof ReactDomNamespace;
  reactNS: typeof ReactNamespace;
}

type ReactSetStateFunction<TData> = React.Dispatch<React.SetStateAction<TData>>;

interface HudHooks {
  labelsElement?: HTMLElement;
  valuesElement?: HTMLElement;
  extrasElement?: HTMLElement;
}

const HUD_LABELS_ELEMENT_NAME = 'overview-extra-hook-0';
const HUD_VALUES_ELEMENT_NAME = 'overview-extra-hook-1';
const HUD_EXTRAS_ELEMENT_NAME = 'overview-extra-hook-2';

// NOTE : These values are pulled from the Game's Debug Console ; the css-****** values on the end apply themed styling and seem to be randomly generated at compile time, but are consistent between game executions
const DIV_BORDER_CSS_CLASS = 'css-tlze81';
const BUTTON_CSS_CLASS = 'css-13ak5e0';
const TOGGLE_BUTTON_CSS_CLASS = 'css-1k9ietj';
const TOGGLE_BUTTON_SELECTED_CSS_CLASS = 'Mui-selected';

// NOTE : DO NOT NAME THE VARIABLE YOU STORE THE RESULT IN 'window' OR ELSE YOU WILL INCUR THE USUAL 25GB RAM USAGE
function getWindow() {
  return globalThis['window'] as Window;
}

// NOTE : DO NOT NAME THE VARIABLE YOU STORE THE RESULT IN 'document' OR ELSE YOU WILL INCUR THE USUAL 25GB RAM USAGE
function getDocument() {
  return globalThis['document'];
}

function getReactModel() {
  const result: ReactModel = {
    reactDOM: globalThis.ReactDOM,
    reactNS: globalThis.React,
  };
  return result;
}

function getHudHooks(): HudHooks {
  const doc = getDocument();
  return {
    labelsElement: doc.getElementById(HUD_LABELS_ELEMENT_NAME) ?? undefined,
    valuesElement: doc.getElementById(HUD_VALUES_ELEMENT_NAME) ?? undefined,
    extrasElement: doc.getElementById(HUD_EXTRAS_ELEMENT_NAME) ?? undefined,
  };
}

function getHtmlElement(tagName = 'element') {
  return getDocument().createElement(tagName);
}

function runTerminalCommand(cmd: string) {
  const doc = getDocument();

  const terminalInput = doc.getElementById(
    'terminal-input'
  ) as HTMLInputElement;
  if (!terminalInput) {
    return false;
  }
  terminalInput.value = cmd;

  const eventHandlerKey = Object.keys(terminalInput)[1];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const anyTerminalInput = terminalInput as any;
  anyTerminalInput[eventHandlerKey].onChange({target: terminalInput});
  anyTerminalInput[eventHandlerKey].onKeyDown({
    key: 'Enter',
    preventDefault: () => undefined,
  });
  return true;
}

function openTail(
  netscript: NS,
  xPos?: number,
  yPos?: number,
  width?: number,
  height?: number,
  scriptPid?: number
) {
  netscript.tail(scriptPid);
  if (xPos !== undefined && yPos !== undefined) {
    netscript.moveTail(xPos, yPos, scriptPid);
  }
  if (width !== undefined && height !== undefined) {
    netscript.resizeTail(width, height, scriptPid);
  }
}

export {
  ReactModel,
  ReactSetStateFunction,
  HudHooks,
  DIV_BORDER_CSS_CLASS,
  BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_CSS_CLASS,
  TOGGLE_BUTTON_SELECTED_CSS_CLASS,
  getWindow,
  getDocument,
  getReactModel,
  getHudHooks,
  getHtmlElement,
  runTerminalCommand,
  openTail,
};
