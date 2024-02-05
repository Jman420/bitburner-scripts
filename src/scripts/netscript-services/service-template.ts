import {NS} from '@ns';

import {CmdArgsSchema, parseCmdFlags} from '/scripts/workflows/cmd-args';
import {UNDEFINED_STR} from '/scripts/netscript-services/shared';

export const CMD_FLAG_FUNCTION_PATH = 'functionPath';
export const CMD_FLAG_PARAMETERS = 'parameters';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_FUNCTION_PATH, ''],
  [CMD_FLAG_PARAMETERS, ''],
];

/** @param {NS} ns */
export async function main(netscript: NS) {
  netscript.enableLog('ALL');

  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const functionPath = cmdArgs[CMD_FLAG_FUNCTION_PATH].valueOf() as string;
  const parametersString = cmdArgs[CMD_FLAG_PARAMETERS].valueOf() as string;
  const parameters =
    parametersString !== '' ? JSON.parse(parametersString) : [];

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let nsFunction: any = netscript;
  for (const pathEntry of functionPath.split('.')) {
    nsFunction = nsFunction[pathEntry];
  }
  const result = await nsFunction(...parameters);
  netscript.writePort(
    netscript.pid,
    result === undefined ? UNDEFINED_STR : JSON.stringify(result)
  );
}
