import {AutocompleteData, NS} from '@ns';

import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {findContracts, getContractSolver} from '/scripts/workflows/contracts';

import {
  CmdArgsSchema,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {
  delayedInfiniteLoop,
  initializeScript,
} from '/scripts/workflows/execution';

import {openTail} from '/scripts/workflows/ui';
import {SCRIPTS_DIR} from '/scripts/common/shared';

export const CONTRACTS_AUTO_SCRIPT = `${SCRIPTS_DIR}/contracts-auto.js`;
const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_INCLUDE_HOME, false]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'contracts-auto';
const SUBSCRIBER_NAME = 'contracts-auto';

const TAIL_X_POS = 840;
const TAIL_Y_POS = 185;
const TAIL_WIDTH = 1115;
const TAIL_HEIGHT = 500;

const UPDATE_DELAY = 3.6e6; // 1hr

async function solveContracts(
  nsPackage: NetscriptPackage,
  includeHome: boolean,
  logWriter: Logger
) {
  const nsLocator = nsPackage.locator;

  logWriter.writeLine('Finding coding contracts...');
  const codingContacts = await findContracts(nsPackage, includeHome);
  logWriter.writeLine(`Found ${codingContacts.length} coding contracts.`);
  logWriter.writeLine('Attemping to solve coding contracts...');
  for (const contract of codingContacts) {
    const contractSolver = getContractSolver(contract);
    let solutionResult = 'skipped';
    if (contractSolver) {
      const challengeInput = contractSolver.parseInputFunc(contract.data);
      const solution = contractSolver.solveFunc(...challengeInput);
      solutionResult = await nsLocator.codingcontract['attempt'](
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
  logWriter.writeLine(SECTION_DIVIDER);
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  terminalWriter.writeLine('Automatically Solve Coding Contracts');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const includeHome = cmdArgs[CMD_FLAG_INCLUDE_HOME].valueOf() as boolean;

  terminalWriter.writeLine(`Include Home : ${includeHome}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine(
    'See script logs for on-going contract solving details.'
  );
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  await delayedInfiniteLoop(
    netscript,
    UPDATE_DELAY,
    solveContracts,
    nsPackage,
    includeHome,
    scriptLogWriter
  );
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function autocomplete(data: AutocompleteData, args: string[]) {
  return CMD_FLAGS;
}
