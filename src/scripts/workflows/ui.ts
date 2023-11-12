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

export {HudHooks, getWindow, getDocument, getHUD, getHtmlElement};
