import { registerEndpoint, removeEndpoint } from "/scripts/netscript-services/netscript-locator";
import { delayedInfiniteLoop } from "/scripts/workflows/execution";

const UPDATE_DELAY = 0;

let serviceCalled = false;

function handleServiceCall(netscript, ...args) {
  serviceCalled = true;
  return netscript.path.FUNCTION_NAME(...args);
}

async function handleShutdown(netscript) {
  SHUTDOWN_DELAY;

  if (!serviceCalled) {
    netscript.exit();
    return;
  }
  serviceCalled = false;
}

/** @param {NS} ns */
export async function main(netscript) {
  netscript.atExit(() => {
    removeEndpoint(netscript.path, 'FUNCTION_NAME');
  });

  netscript.path.FUNCTION_NAME;
  registerEndpoint(netscript.path, 'FUNCTION_NAME', handleServiceCall.bind(undefined, netscript));
  netscript.writePort(netscript.pid, 1);

  await delayedInfiniteLoop(netscript, UPDATE_DELAY, handleShutdown.bind(undefined, netscript));
}
