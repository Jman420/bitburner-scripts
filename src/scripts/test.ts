import {AutocompleteData, NS} from '@ns';

export function autocomplete(data: AutocompleteData, args: string[]) {
  console.log('pong');
  return ['why', 'dont', 'this', 'work'];
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  netscript.tprint('Ping');
}