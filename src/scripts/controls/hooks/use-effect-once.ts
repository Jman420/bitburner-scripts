// Adapted from usehooks-ts npm package ; https://github.com/juliencrn/usehooks-ts/blob/master/packages/usehooks-ts/src/useEffectOnce/useEffectOnce.ts

import {getReactModel} from '/scripts/workflows/ui';

const React = getReactModel().reactNS;

function useEffectOnce(effect: React.EffectCallback) {
  React.useEffect(effect, []);
}

export {useEffectOnce};
