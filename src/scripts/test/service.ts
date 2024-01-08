import { NS } from "@ns";
import { registerEndpoint, removeEndpoint } from "/scripts/netscript-services/netscript-locator";

/** @param {NS} netscript */
export async function main(netscript: NS) {
  netscript.getPlayer;
  netscript.atExit(() => {
    removeEndpoint(netscript, 'tprint');
    removeEndpoint(netscript, 'getPlayer');
  })

  registerEndpoint(netscript, 'tprint');
  registerEndpoint(netscript, 'getPlayer');

  while (true) {
    await netscript.asleep(5000);
  }
}
