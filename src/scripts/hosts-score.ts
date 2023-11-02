import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  BOOLEAN_AUTOCOMPLETE,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {
  analyzeHost,
  scanWideNetwork,
  sortOptimalTargetHosts,
} from '/scripts/workflows/recon';

const CMD_FLAG_TOP_ONLY = 'topOnly';
const CMD_FLAG_INCLUDE_DETAIL = 'detail';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_TOP_ONLY, 0],
  [CMD_FLAG_INCLUDE_DETAIL, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(netscript, 'hosts-score', LoggerMode.TERMINAL);
  logWriter.writeLine('Target Hosts Score Report');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const topOnly = cmdArgs[CMD_FLAG_TOP_ONLY].valueOf() as string;
  const includeDetails = cmdArgs[CMD_FLAG_INCLUDE_DETAIL].valueOf() as boolean;

  logWriter.writeLine(`Top Only : ${topOnly}`);
  logWriter.writeLine(`Include Details : ${includeDetails}`);
  logWriter.writeLine(SECTION_DIVIDER);

  const targetHosts = scanWideNetwork(netscript, false, true, false, true);
  const targetsAnalysis = targetHosts.map(hostname =>
    analyzeHost(netscript, hostname)
  );
  sortOptimalTargetHosts(targetsAnalysis);

  for (
    let targetCounter = 0;
    targetCounter < targetsAnalysis.length;
    targetCounter++
  ) {
    const targetDetails = targetsAnalysis[targetCounter];
    logWriter.writeLine(
      `${targetCounter} - ${targetDetails.hostname} : ${targetDetails.score}`
    );
    if (includeDetails) {
      logWriter.writeLine('  Details To Be Added!');
      // TODO (JMG) : Add Scoring Details
    }
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TOP_ONLY)) {
    return ['1', '2', '3', '5', '10', '15'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_INCLUDE_DETAIL)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
