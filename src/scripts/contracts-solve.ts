import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  ChallengeSolution,
  CodingContract,
  findContracts,
  getContractSolutionFunc,
} from '/scripts/workflows/contracts';

import {
  BOOLEAN_AUTOCOMPLETE,
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';
import {HOME_SERVER_NAME} from '/scripts/common/shared';

const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAG_ONLY_HOME = 'onlyHome';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_ONLY_HOME, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const logWriter = getLogger(
    netscript,
    'contracts-solve',
    LoggerMode.TERMINAL
  );
  logWriter.writeLine('Automatically Solve Known Coding Contracts');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;
  const onlyHome = cmdArgs[CMD_FLAG_ONLY_HOME].valueOf() as boolean;

  logWriter.writeLine(`Include Home : ${includeHome}`);
  logWriter.writeLine(`Only Home : ${onlyHome}`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Finding coding contracts...');
  let codingContacts: Array<CodingContract>;
  if (onlyHome) {
    codingContacts = findContracts(netscript, includeHome, [HOME_SERVER_NAME]);
  } else {
    codingContacts = findContracts(netscript, includeHome);
  }

  logWriter.writeLine(`Found ${codingContacts.length} coding contracts.`);
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Attemping to solve coding contracts...');
  for (const contract of codingContacts) {
    const solutionFunc = getContractSolutionFunc(contract);
    let solutionResult = 'skipped';
    if (solutionFunc) {
      let solution: ChallengeSolution;
      if (Array.isArray(contract.data)) {
        solution = solutionFunc(...contract.data);
      } else {
        solution = solutionFunc(contract.data);
      }

      solutionResult = netscript.codingcontract.attempt(
        solution,
        contract.filename,
        contract.hostname
      );
      if (!solutionResult) {
        solutionResult = 'failed';
        contract.attemptsRemaining--;
      }
    }
    logWriter.writeLine(
      `  ${contract.hostname} - ${contract.type} : ${contract.filename} # ${contract.attemptsRemaining} ? ${solutionResult}`
    );
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_INCLUDE_HOME)) {
    return BOOLEAN_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
