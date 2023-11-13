import {NS} from '@ns';

interface HudHooks {
  labelsElement?: HTMLElement;
  valuesElement?: HTMLElement;
}

const HUD_LABELS_ELEMENT_NAME = 'overview-extra-hook-0';
const HUD_VALUES_ELEMENT_NAME = 'overview-extra-hook-1';

// NOTE : DO NOT NAME THE VARIABLE YOU STORE THE RESULT IN 'window' OR ELSE YOU WILL INCUR THE USUAL 25GB RAM USAGE
function getWindow() {
  return globalThis['window'] as Window;
}

// NOTE : DO NOT NAME THE VARIABLE YOU STORE THE RESULT IN 'document' OR ELSE YOU WILL INCUR THE USUAL 25GB RAM USAGE
function getDocument() {
  return globalThis['document'];
}

function getHUD(): HudHooks {
  const doc = getDocument();
  return {
    labelsElement: doc.getElementById(HUD_LABELS_ELEMENT_NAME) ?? undefined,
    valuesElement: doc.getElementById(HUD_VALUES_ELEMENT_NAME) ?? undefined,
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
    netscript.moveTail(xPos, yPos);
  }
  if (width !== undefined && height !== undefined) {
    netscript.resizeTail(width, height);
  }
}

export {
  HudHooks,
  getWindow,
  getDocument,
  getHUD,
  getHtmlElement,
  runTerminalCommand,
  openTail,
};
