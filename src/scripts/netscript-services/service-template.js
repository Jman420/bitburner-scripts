import { registerEndpoint } from "/scripts/netscript-services/netscript-locator";
import { infiniteLoop } from "/scripts/workflows/execution";

/** @param {NS} ns */
export async function main(netscript) {
  registerEndpoint(netscript.path, '<FUNCTION_NAME>');
  await infiniteLoop(netscript, () => {});
}
