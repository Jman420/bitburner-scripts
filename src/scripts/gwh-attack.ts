import {AutocompleteData, NS} from '@ns';

import {SCRIPTS_PATH} from '/scripts/common/shared';

import {Logger, getLogger} from '/scripts/logging/loggerManager';
import {ENTRY_DIVIDER, SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {infiniteLoop} from '/scripts/workflows/execution';
import {scanLocalNetwork, analyzeHost} from '/scripts/workflows/recon';
import {growWeakenHack} from '/scripts/workflows/attack';

import {WORKFLOWS_PACKAGE} from '/scripts/workflows/package';
import {
  CMD_FLAG_TARGETS,
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

const ATTACK_SCRIPT = `${SCRIPTS_PATH}/gwh-attack.js`;
const PAYLOAD_PACKAGE = [ATTACK_SCRIPT].concat(WORKFLOWS_PACKAGE);

const CMD_FLAG_SECURITY_LIMIT_MULTIPLIER = 'securityLimitMultiplier';
const CMD_FLAG_FUNDS_LIMIT_MULTIPLIER = 'fundsLimitMultiplier';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_SECURITY_LIMIT_MULTIPLIER, 1],
  [CMD_FLAG_FUNDS_LIMIT_MULTIPLIER, 1],
  [CMD_FLAG_TARGETS, []],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

async function attackNetwork(
  netscript: NS,
  logWriter: Logger,
  targetHosts: string[] = [],
  securityLimitMultiplier = 1,
  fundsLimitMultiplier = 1
) {
  if (!targetHosts.length) {
    targetHosts = scanLocalNetwork(netscript, undefined, false, true);
  }
  logWriter.writeLine(`Found ${targetHosts.length} available hosts`);

  for (const hostname of targetHosts) {
    logWriter.writeLine(ENTRY_DIVIDER);
    logWriter.writeLine(`Analyzing server : ${hostname}`);
    const serverDetails = analyzeHost(netscript, hostname);

    logWriter.writeLine('  Grow-Weaken-Hack Attacking Server...');
    await growWeakenHack(
      netscript,
      serverDetails,
      securityLimitMultiplier,
      fundsLimitMultiplier
    );
  }
}

/** @param {NS} netscript */
async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'gwh-attack');
  logWriter.writeLine('Local Network Grow-Weaken-Hack Attack');
  logWriter.writeLine(`Local Host : ${netscript.getHostname()}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const securityLimitMultiplier = cmdArgs[
    CMD_FLAG_SECURITY_LIMIT_MULTIPLIER
  ].valueOf() as number;
  const fundsLimitMultiplier = cmdArgs[
    CMD_FLAG_FUNDS_LIMIT_MULTIPLIER
  ].valueOf() as number;
  const targetHosts = cmdArgs[CMD_FLAG_TARGETS].valueOf() as string[];

  logWriter.writeLine(`Security Limit Multiplier : ${securityLimitMultiplier}`);
  logWriter.writeLine(`Funds Limit Multiplier : ${fundsLimitMultiplier}`);
  logWriter.writeLine(`Target Hosts : ${targetHosts}`);
  logWriter.writeLine(SECTION_DIVIDER);

  await infiniteLoop(
    netscript,
    attackNetwork,
    netscript,
    logWriter,
    targetHosts,
    securityLimitMultiplier,
    fundsLimitMultiplier
  );
}

function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (
    lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_MULTIPLIER) ||
    lastCmdFlag === getCmdFlag(CMD_FLAG_SECURITY_LIMIT_MULTIPLIER)
  ) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TARGETS)) {
    return data.servers;
  }

  return CMD_FLAGS;
}

export {
  ATTACK_SCRIPT,
  PAYLOAD_PACKAGE,
  CMD_FLAG_SECURITY_LIMIT_MULTIPLIER,
  CMD_FLAG_FUNDS_LIMIT_MULTIPLIER,
  main,
  autocomplete,
};
