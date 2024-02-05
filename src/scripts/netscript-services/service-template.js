import { registerEndpoint, removeEndpoint } from "/scripts/netscript-services/netscript-locator";

let serviceCalled = false;
let functionResolved = true;

async function handleServiceCall(netscript, ...args) {
  serviceCalled = true;
  functionResolved = false;
  const result = await netscript.path.FUNCTION_NAME(...args);
  functionResolved = true;
  return result;
}

async function handleShutdown(netscript) {
  SHUTDOWN_DELAY;

  const result = !serviceCalled && functionResolved;
  serviceCalled = false;
  return result;
}

/** @param {NS} ns */
export async function main(netscript) {
  netscript.enableLog('ALL');

  netscript.atExit(() => {
    removeEndpoint(netscript.path, 'FUNCTION_NAME');
  });
  
  registerEndpoint(netscript.path, 'FUNCTION_NAME', handleServiceCall.bind(undefined, netscript));
  netscript.writePort(netscript.pid, 1);

  // TODO (JMG) : Replace shutdown logic with logic to await another write to its PID Port
  while (!await handleShutdown(netscript)) {}
}
