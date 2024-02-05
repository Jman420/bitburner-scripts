import {AutocompleteData, NS} from '@ns';

import {getGhostPackage} from '/scripts/netscript-services/netscript-ghost';

import {LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {initializeScript} from '/scripts/workflows/execution';

const CMD_FLAG_CONTRACT_TYPE = 'contractType';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [[CMD_FLAG_CONTRACT_TYPE, []]];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'contracts-dummy';
const SUBSCRIBER_NAME = 'contracts-dummy';

let CONTRACT_TYPES: string[];

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getGhostPackage(netscript);
  const nsLocator = nsPackage.ghost;
  const contractApi = nsLocator.codingcontract;

  CONTRACT_TYPES = (await contractApi['getContractTypes']()).map(
    value => `'${value}'`
  );

  initializeScript(netscript, SUBSCRIBER_NAME);
  const logWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  logWriter.writeLine('Create Dummy Coding Contract');
  logWriter.writeLine(SECTION_DIVIDER);

  logWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const contractTypes = cmdArgs[CMD_FLAG_CONTRACT_TYPE].valueOf() as string[];

  logWriter.writeLine(`Contract Types : ${contractTypes}`);
  logWriter.writeLine(SECTION_DIVIDER);

  if (contractTypes.length < 1) {
    logWriter.writeLine('No Contract Types provided.');
    logWriter.writeLine(SECTION_DIVIDER);
    logWriter.writeLine('Available Contract Types :');
    for (const type of CONTRACT_TYPES) {
      logWriter.writeLine(`  ${type}`);
    }
    return;
  }

  for (const type of contractTypes) {
    logWriter.writeLine(`Creating Dummy Contract for : ${type}`);
    await contractApi['createDummyContract'](type);
  }
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_CONTRACT_TYPE)) {
    if (!CONTRACT_TYPES || CONTRACT_TYPES.length < 1) {
      return ['Run script to initialize Contract Types!'];
    }
    return CONTRACT_TYPES;
  }
  return CMD_FLAGS;
}
