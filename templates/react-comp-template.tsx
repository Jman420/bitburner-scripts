import {NS, UserInterfaceTheme} from '@ns';

import {getReactModel} from '/scripts/workflows/ui';

import {EventListener} from '/scripts/comms/event-comms';

const React = getReactModel().reactNS;
const useState = React.useState;

function ComponentTemplate({
  netscript,
  eventListener,
  uiTheme,
}: {
  netscript: NS;
  eventListener: EventListener;
  uiTheme: UserInterfaceTheme;
}) {
  const [testValue, setTestValue] = useState('default value');

  return (
    <div>{testValue}</div>
  );
}

export {ComponentTemplate};
