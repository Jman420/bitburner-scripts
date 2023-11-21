import { UserInterfaceTheme } from '@ns';

import {getReactModel} from '/scripts/workflows/ui';

const React = getReactModel().reactNS;
const useState = React.useState;

function ComponentTemplate({uiTheme}: {uiTheme: UserInterfaceTheme}) {
  const [testValue, setTestValue] = useState('default value');
  
  return (
    <div>{testValue}</div>
  );
}

export {ComponentTemplate};
