// Adapted from usehooks-ts npm package ; https://github.com/juliencrn/usehooks-ts/blob/master/packages/usehooks-ts/src/useInterval/useInterval.ts

import {getReactModel} from '/scripts/workflows/ui';

const React = getReactModel().reactNS;

// NOTE : Set delay to undefined to stop the interval callback
function useInterval(callback: () => void, delay: number | undefined) {
  const savedCallback = React.useRef(callback);

  // Remember the latest callback if it changes.
  React.useLayoutEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  React.useEffect(() => {
    // Don't schedule if no delay is specified.
    // Note: 0 is a valid value for delay.
    if (!delay && delay !== 0) {
      return;
    }

    const id = setInterval(() => savedCallback.current(), delay);

    return () => clearInterval(id);
  }, [delay]);
}

export {useInterval};
