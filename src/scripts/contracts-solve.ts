import {AutocompleteData, NS} from '@ns';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CodingContract,
  findContracts,
  getContractSolver,
} from '/scripts/workflows/contracts';

import {
  CmdArgsSchema,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';

import {HOME_SERVER_NAME} from '/scripts/common/shared';

const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAG_ONLY_HOME = 'onlyHome';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_INCLUDE_HOME, false],
  [CMD_FLAG_ONLY_HOME, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'contracts-solve';
const SUBSCRIBER_NAME = 'contracts-solve';

/** @param {NS} netscript */
export async function main(netscript: NS) {
  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
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
    const contractSolver = getContractSolver(contract);
    let solutionResult = 'skipped';
    if (contractSolver) {
      const challengeInput = contractSolver.parseInputFunc(contract.data);
      const solution = contractSolver.solveFunc(...challengeInput);
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

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  return CMD_FLAGS;
}
