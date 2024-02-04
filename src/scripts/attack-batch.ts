import {AutocompleteData, NS} from '@ns';

import {Logger, LoggerMode, getLogger} from '/scripts/logging/loggerManager';
import {SECTION_DIVIDER} from '/scripts/logging/logOutput';

import {
  CmdArgsSchema,
  PERCENT_AUTOCOMPLETE,
  getCmdFlag,
  getLastCmdFlag,
  getSchemaFlags,
  parseCmdFlags,
} from '/scripts/workflows/cmd-args';

import {infiniteLoop, initializeScript} from '/scripts/workflows/execution';
import {SCRIPTS_DIR} from '/scripts/common/shared';
import {
  NetscriptPackage,
  getLocatorPackage,
} from '/scripts/netscript-services/netscript-locator';
import {openTail} from '/scripts/workflows/ui';
import {EventListener, sendMessage} from '/scripts/comms/event-comms';
import {ExitEvent} from '/scripts/comms/events/exit-event';
import {AttackBatchConfig} from '/scripts/workflows/attacks';
import {AttackBatchConfigEvent} from '/scripts/comms/events/attack-batch-config-event';
import {AttackBatchConfigRequest} from '/scripts/comms/requests/attack-batch-config-request';
import {AttackBatchConfigResponse} from '/scripts/comms/responses/attack-batch-config-response';
import {scanWideNetwork} from '/scripts/workflows/recon';

export const ATTACK_BATCH_SCRIPT = `${SCRIPTS_DIR}/attack-batch.js`;

export const CMD_FLAG_TARGET = 'target';
export const CMD_FLAG_HACK_PERCENT = 'hackPercent';
export const CMD_FLAG_FUNDS_LIMIT_PERCENT = 'fundsLimitPercent';
export const CMD_FLAG_INCLUDE_HOME = 'includeHome';
const CMD_FLAGS_SCHEMA: CmdArgsSchema = [
  [CMD_FLAG_TARGET, ''],
  [CMD_FLAG_HACK_PERCENT, 0.1],
  [CMD_FLAG_FUNDS_LIMIT_PERCENT, 1],
  [CMD_FLAG_INCLUDE_HOME, false],
];
const CMD_FLAGS = getSchemaFlags(CMD_FLAGS_SCHEMA);

const MODULE_NAME = 'attack-batch';
const SUBSCRIBER_NAME = 'attack-batch';

const TAIL_X_POS = 1015;
const TAIL_Y_POS = 105;
const TAIL_WIDTH = 650;
const TAIL_HEIGHT = 500;

let scriptConfig: AttackBatchConfig;
let workerPids: number[] | undefined;

async function manageAttacks(nsPackage: NetscriptPackage, logWriter: Logger) {
  const nsLocator = nsPackage.locator;
  const netscript = nsPackage.netscript;

  const targetHosts = scanWideNetwork(netscript, false, false, false, true);
}

async function getOptimalTarget(nsPackage: NetscriptPackage) {}

function handleUpdateConfigEvent(
  eventData: AttackBatchConfigEvent,
  logWriter: Logger
) {
  if (!eventData.config) {
    return;
  }

  logWriter.writeLine('Update settings event received...');
  const newConfig = eventData.config;
  scriptConfig.hackFundsPercent =
    newConfig.hackFundsPercent ?? scriptConfig.hackFundsPercent;
  scriptConfig.fundsMaxPercent =
    newConfig.fundsMaxPercent ?? scriptConfig.fundsMaxPercent;
  scriptConfig.includeHomeAttacker =
    newConfig.includeHomeAttacker ?? scriptConfig.includeHomeAttacker;

  logWriter.writeLine(`  Hack Percent : ${scriptConfig.hackFundsPercent}`);
  logWriter.writeLine(
    `  Funds Limit Percent : ${scriptConfig.fundsMaxPercent}`
  );
  logWriter.writeLine(
    `  Include Home Attacker : ${scriptConfig.includeHomeAttacker}`
  );
}

function handleConfigRequest(
  requestData: AttackBatchConfigRequest,
  logWriter: Logger
) {
  logWriter.writeLine(
    `Sending batch attack config response to ${requestData.sender}`
  );
  sendMessage(new AttackBatchConfigResponse(scriptConfig), requestData.sender);
}

function handleExit(eventData: ExitEvent, netscript: NS) {
  if (workerPids) {
    for (const pid of workerPids) {
      netscript.kill(pid);
    }
  }
}

/** @param {NS} netscript */
export async function main(netscript: NS) {
  const nsPackage = getLocatorPackage(netscript);

  initializeScript(netscript, SUBSCRIBER_NAME);
  const terminalWriter = getLogger(netscript, MODULE_NAME, LoggerMode.TERMINAL);
  const scriptLogWriter = getLogger(netscript, MODULE_NAME, LoggerMode.SCRIPT);
  terminalWriter.writeLine('Hack Attack Script - Shotgun Batch');
  terminalWriter.writeLine(SECTION_DIVIDER);

  terminalWriter.writeLine('Parsing command line arguments...');
  const cmdArgs = parseCmdFlags(netscript, CMD_FLAGS_SCHEMA);
  const hackFundsPercent = cmdArgs[CMD_FLAG_HACK_PERCENT].valueOf() as number;
  const fundsLimitPercent = cmdArgs[
    CMD_FLAG_FUNDS_LIMIT_PERCENT
  ].valueOf() as number;
  const includeHomeAttacker = cmdArgs[
    CMD_FLAG_INCLUDE_HOME
  ].valueOf() as boolean;

  terminalWriter.writeLine(`Hack Funds Percent : ${hackFundsPercent}`);
  terminalWriter.writeLine(`Funds Limit Percent : ${fundsLimitPercent}`);
  terminalWriter.writeLine(`Include Home Attacker : ${includeHomeAttacker}`);
  terminalWriter.writeLine(SECTION_DIVIDER);

  scriptConfig = {
    includeHomeAttacker: includeHomeAttacker,
    hackFundsPercent: hackFundsPercent,
    fundsMaxPercent: fundsLimitPercent,
  };

  terminalWriter.writeLine('See script logs for on-going attack details.');
  openTail(netscript, TAIL_X_POS, TAIL_Y_POS, TAIL_WIDTH, TAIL_HEIGHT);

  const eventListener = new EventListener(SUBSCRIBER_NAME);
  eventListener.addListener(ExitEvent, handleExit, netscript);
  eventListener.addListener(
    AttackBatchConfigEvent,
    handleUpdateConfigEvent,
    scriptLogWriter
  );
  eventListener.addListener(
    AttackBatchConfigRequest,
    handleConfigRequest,
    scriptLogWriter
  );

  await infiniteLoop(
    netscript,
    manageAttacks,
    undefined,
    nsPackage,
    scriptLogWriter
  );
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  const lastCmdFlag = getLastCmdFlag(args);
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_HACK_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  if (lastCmdFlag === getCmdFlag(CMD_FLAG_FUNDS_LIMIT_PERCENT)) {
    return PERCENT_AUTOCOMPLETE;
  }
  return CMD_FLAGS;
}
