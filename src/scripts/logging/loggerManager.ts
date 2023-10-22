import {NS} from '@ns';

import {ScriptLogger} from '/scripts/logging/scriptLogger';
import {TerminalLogger} from '/scripts/logging/terminalLogger';
import {NoopLooger} from '/scripts/logging/noopLogger';
import {ConsoleLogger} from '/scripts/logging/consoleLogger';

type Logger = ConsoleLogger | ScriptLogger | TerminalLogger | NoopLooger;

enum LoggerMode {
  CONSOLE,
  SCRIPT,
  TERMINAL,
  NOOP,
}

function getLogger(
  netscript: NS,
  moduleName: string,
  loggerMode = LoggerMode.NOOP
): Logger {
  let result: Logger;
  if (loggerMode === LoggerMode.CONSOLE) {
    result = new ConsoleLogger(netscript, moduleName);
  } else if (loggerMode === LoggerMode.SCRIPT) {
    result = new ScriptLogger(netscript, moduleName);
  } else if (loggerMode === LoggerMode.TERMINAL) {
    result = new TerminalLogger(netscript, moduleName);
  } else {
    result = new NoopLooger(netscript, moduleName);
  }
  return result;
}
export {Logger, LoggerMode, getLogger};
