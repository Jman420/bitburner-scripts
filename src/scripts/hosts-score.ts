import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {
  SECTION_DIVIDER,
  convertMillisecToTime,
} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';

import {
  analyzeHost,
  filterHostsCanHack,
  scanWideNetwork,
} from '/scripts/workflows/recon';
import {
  ServerDetailsExtended,
  getHackingExpGain,
  scoreHostForExperience,
  scoreHostForAttack,
  sortOptimalTargetHosts,
} from '/scripts/workflows/scoring';
import {getLocatorPackage} from '/scripts/netscript-services/netscript-locator';

const CMD_FLAG_ARG_WGWH_SCORE_FUNCTION = 'wgwh';
const CMD_FLAG_ARG_EXP_FARM_FUNCTION = 'expFarm';
const CMD_ARGS_FLAG_SCORING_FUNC = [
  CMD_FLAG_ARG_WGWH_SCORE_FUNCTION,
  CMD_FLAG_ARG_EXP_FARM_FUNCTION,
];

const CMD_FLAG_TOP_ONLY = 'topOnly';
const CMD_FLAG_INCLUDE_DETAIL = 'detail';
const CMD_FLAG_SCORING_FUNC = 'scoringFunc';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_TOP_ONLY, 0],
  [CMD_FLAG_INCLUDE_DETAIL, false],
  [CMD_FLAG_SCORING_FUNC, CMD_FLAG_ARG_WGWH_SCORE_FUNCTION],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'hosts-score';
const SUBSCRIBER_NAME = 'hosts-score';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Target Hosts Score Report');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const topOnly = cmdArgs[CMD_FLAG_TOP_ONLY].valueOf() as string;
  const includeDetails = cmdArgs[CMD_FLAG_INCLUDE_DETAIL].valueOf() as boolean;
  const scoreFunc = cmdArgs[CMD_FLAG_SCORING_FUNC].valueOf() as string;

  logWriter.writeLine(`Top Only : ${topOnly}`);
  logWriter.writeLine(`Include Details : ${includeDetails}`);
  logWriter.writeLine(`Score Function : ${scoreFunc}`);
  logWriter.writeLine(SECTION_DIVIDER);

  let targetHosts = scanWideNetwork(netscript, {
    rootOnly: true,
    requireFunds: true,
  });
  targetHosts = filterHostsCanHack(netscript, targetHosts);
  let targetsAnalysis = targetHosts.map(hostname =>
    analyzeHost(netscript, hostname)
  );
  if (scoreFunc === CMD_FLAG_ARG_WGWH_SCORE_FUNCTION) {
    sortOptimalTargetHosts(targetsAnalysis, undefined, scoreHostForAttack);
  } else if (scoreFunc === CMD_FLAG_ARG_EXP_FARM_FUNCTION) {
    targetsAnalysis = await Promise.all(
      targetsAnalysis.map(async value => {
        const extendedValue = value as ServerDetailsExtended;
        extendedValue.expGain = await getHackingExpGain(
          nsPackage,
          value.hostname
        );
        return extendedValue;
      })
    );
    sortOptimalTargetHosts(targetsAnalysis, undefined, scoreHostForExperience);
  } else {
    logWriter.writeLine(
      `Unrecognized scoring function : ${scoreFunc}.  Scoring function must be one of : ${CMD_ARGS_FLAG_SCORING_FUNC}`
    );
    return;
  }

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
      logWriter.writeLine(
        `  Max Funds : ${netscript.formatNumber(targetDetails.maxFunds)}`
      );
      logWriter.writeLine(
        `  Weaken Time : ${convertMillisecToTime(targetDetails.weakenTime)}`
      );
      logWriter.writeLine(
        `  Grow Time : ${convertMillisecToTime(targetDetails.growTime)}`
      );
      logWriter.writeLine(`  Grow Rate : ${targetDetails.growRate}`);
      logWriter.writeLine(
        `  Hack Time : ${convertMillisecToTime(targetDetails.hackTime)}`
      );
    }
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_TOP_ONLY)) {
    return ['1', '2', '3', '5', '10', '15'];
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_SCORING_FUNC)) {
    return CMD_ARGS_FLAG_SCORING_FUNC;
  }
  return CMD_FLAGS;
}
