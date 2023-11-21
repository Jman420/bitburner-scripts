import {getReactModel} from '/scripts/workflows/ui';

const React = getReactModel().reactNS;
const useState = React.useState;

function componentTemplate() {
  const [testValue, setTestValue] = useState('default value');
  
  return <div>{testValue}</div>;
}

export {componentTemplate};
