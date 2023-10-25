import {NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {CmdArgsSchema, HOME_SERVER_NAME} from '/scripts/common/shared';
import {scanLocalNetwork} from '/scripts/workflows/recon';
import { parseCmdFlags } from '/scripts/workflows/cmd-args';

const CMD_ARG_TARGET = 'target';
const CMD_ARGS_SCHEMA: CmdArgsSchema = [[CMD_ARG_TARGET, '']];

function findHostPath(
  netscript: NS,
  hostname: string,
  targetHost: string,
  path: string[] = [],
  traversedHosts: string[] = []
) {
  if (hostname === targetHost) {
    path.unshift(hostname);
    return path;
  }

  traversedHosts.push(hostname);
  const localHosts = scanLocalNetwork(netscript, hostname, false, false).filter(
    value => !traversedHosts.includes(value)
  );
  for (const nextHost of localHosts) {
    if (findHostPath(netscript, nextHost, targetHost, path, traversedHosts)) {
      path.unshift(hostname);
      return path;
    }
  }
  return undefined;
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'find-host-path', LoggerMode.TERMINAL);
  logWriter.writeLine('Find Path to Host');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_ARGS_SCHEMA);
  const targetHost = cmdArgs.target.valueOf() as string;

  logWriter.writeLine(`Target Host : ${targetHost}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine(`Finding path to host named ${targetHost}...`);
  const hostPath = findHostPath(netscript, HOME_SERVER_NAME, targetHost);
  if (hostPath) {
    logWriter.writeLine(`Path found : ${hostPath.join(' -> ')}`);
  } else {
    logWriter.writeLine('Path to host not found.');
  }
}
