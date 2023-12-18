import {NS} from '@ns';

import {getReactModel} from '/scripts/workflows/ui';

import {EventListener} from '/scripts/comms/event-comms';

const React = getReactModel().reactNS;
const useState = React.useState;

function ComponentTemplate({
  netscript,
  eventListener,
}: {
  netscript: NS;
  eventListener: EventListener;
}) {
  const uiStyle = netscript.ui.getStyles();
  const uiTheme = netscript.ui.getTheme();
  
  const [testValue, setTestValue] = useState('default value');

  return (
    <div>{testValue}</div>
  );
}

export {ComponentTemplate};
