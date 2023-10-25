import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'script-template', LoggerMode.TERMINAL);
}

export function autocomplete(data: AutocompleteData, args: string[]) {

}
