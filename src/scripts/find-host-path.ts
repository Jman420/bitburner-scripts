import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {HOME_SERVER_NAME} from '/scripts/common/shared';
import {scanLocalNetwork} from '/scripts/workflows/recon';
import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_TARGETS, []]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

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
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  for (const hostname of targetHosts) {
    logWriter.writeLine(`Finding path to host named ${hostname}...`);
    const hostPath = findHostPath(netscript, HOME_SERVER_NAME, hostname);
    if (hostPath) {
      logWriter.writeLine(`Path found : ${hostPath.join(' -> ')}`);
    } else {
      logWriter.writeLine('Path to host not found.');
    }
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}
