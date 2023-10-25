import { NS } from "@ns";

type CmdFlagsEntry = [string, string | number | boolean | string[]];
type CmdArgsSchema = CmdFlagsEntry[];

const CMD_ARG_PREFIX = '--';
const CMD_ARG_HELP = 'help';
const CMD_ARG_TARGETS_CSV = 'targetsCsv';
const CMD_ARGS_HELP_ENTRY: CmdFlagsEntry = [CMD_ARG_HELP, false];

function getCmdFlag(cmdFlagName: string) {
  return `${CMD_ARG_PREFIX}${cmdFlagName}`;
}

function injectHelpFlag(cmdArgsSchema: CmdArgsSchema) {
  if (cmdArgsSchema.indexOf(CMD_ARGS_HELP_ENTRY) < 0) {
    cmdArgsSchema.push(CMD_ARGS_HELP_ENTRY);
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

function printCmdFlags(
  netscript: NS,
  cmdArgsSchema: CmdArgsSchema = []
) {
  if (cmdArgsSchema.length > 0) {
    netscript.tprint('Script Command Line Flags');
    for (const entry of cmdArgsSchema) {
      netscript.tprint(`  ${entry[0]} - ${entry[1]}`);
    }
  }
}

export {CmdFlagsEntry, CmdArgsSchema, CMD_ARG_PREFIX, CMD_ARG_HELP, CMD_ARG_TARGETS_CSV, CMD_ARGS_HELP_ENTRY, getCmdFlag as getCmdArgFlag, injectHelpFlag as getCmdFlagsSchema, parseCmdFlags, printCmdFlags};
