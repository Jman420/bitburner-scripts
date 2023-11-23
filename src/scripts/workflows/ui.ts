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

function getTerminal() {
  const doc = getDocument();
  return (doc.getElementById('terminal-input') ?? undefined) as
    | HTMLInputElement
    | undefined;
}

function getHtmlElement(tagName = 'element') {
  return getDocument().createElement(tagName);
}

function handleDisableTerminal() {
  const terminal = getTerminal();
  if (terminal) {
    terminal.disabled = true;
  }
}

function handleEnableTerminal() {
  const terminal = getTerminal();
  if (terminal) {
    terminal.disabled = false;
  }
}

function handleNumericInputChange(
  setFundsLimit: ReactSetStateFunction<string>,
  eventData: React.ChangeEvent<HTMLInputElement>
) {
  const numValue = Number.parseInt(eventData.target.value.replaceAll(',', ''));
  setFundsLimit(Number.isNaN(numValue) ? '' : numValue.toLocaleString());
}

function runTerminalCommand(cmd: string) {
  const terminalInput = getTerminal();
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
  getWindow,
  getDocument,
  getReactModel,
  getHudHooks,
  getTerminal,
  getHtmlElement,
  handleDisableTerminal,
  handleEnableTerminal,
  handleNumericInputChange,
  runTerminalCommand,
  openTail,
};
