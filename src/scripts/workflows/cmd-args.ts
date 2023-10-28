import {NS} from '@ns';

type CmdFlagsEntry = [string, string | number | boolean | string[]];
type CmdArgsSchema = CmdFlagsEntry[];

const CMD_FLAG_PREFIX = '--';
const CMD_FLAG_HELP = 'help';
const CMD_FLAG_TARGETS = 'targets';
const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAGS_HELP_ENTRY: CmdFlagsEntry = [CMD_FLAG_HELP, false];
const PERCENT_AUTOCOMPLETE = ['1', '0.75', '0.5', '0.25'];
const BOOLEAN_AUTOCOMPLETE = ['true', 'false'];
const POWER_2_AUTOCOMPLETE = ['2', '4', '8', '16', '32', '64'];

function getCmdFlag(cmdFlagName: string) {
  return `${CMD_FLAG_PREFIX}${cmdFlagName}`;
}

function getSchemaFlags(cmdArgsSchema: CmdArgsSchema) {
  const result = cmdArgsSchema.map(value => getCmdFlag(value[0]));
  result.push(getCmdFlag(CMD_FLAG_HELP));
  return result;
}

function getLastCmdFlag(cmdArgs: string[]) {
  for (
    let entryCounter = cmdArgs.length - 1;
    entryCounter >= 0;
    entryCounter--
  ) {
    const argsEntry = cmdArgs[entryCounter];
    if (argsEntry.includes(CMD_FLAG_PREFIX)) {
      return argsEntry;
    }
  }

  return undefined;
}

function injectHelpFlag(cmdArgsSchema: CmdArgsSchema) {
  if (cmdArgsSchema.indexOf(CMD_FLAGS_HELP_ENTRY) < 0) {
    cmdArgsSchema.push(CMD_FLAGS_HELP_ENTRY);
  }
  return cmdArgsSchema;
}

function parseCmdFlags(netscript: NS, cmdArgsSchema: CmdArgsSchema) {
  injectHelpFlag(cmdArgsSchema);
  const cmdArgs = netscript.flags(cmdArgsSchema);
  if (cmdArgs.help) {
    printCmdFlags(netscript, cmdArgsSchema);
    netscript.exit();
  }

  return cmdArgs;
}

function printCmdFlags(netscript: NS, cmdArgsSchema: CmdArgsSchema = []) {
  if (cmdArgsSchema.length > 0) {
    netscript.tprint('Script Command Line Flags');
    for (const entry of cmdArgsSchema) {
      netscript.tprint(`  ${entry[0]} - ${entry[1]}`);
    }
  }
}

export {
  CmdFlagsEntry,
  CmdArgsSchema,
  CMD_FLAG_PREFIX,
  CMD_FLAG_HELP,
  CMD_FLAG_TARGETS,
  CMD_FLAG_INCLUDE_HOME,
  CMD_FLAGS_HELP_ENTRY,
  PERCENT_AUTOCOMPLETE,
  BOOLEAN_AUTOCOMPLETE,
  POWER_2_AUTOCOMPLETE,
  getCmdFlag,
  getSchemaFlags,
  getLastCmdFlag,
  injectHelpFlag,
  parseCmdFlags,
  printCmdFlags,
};
