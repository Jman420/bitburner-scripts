import { NS } from "@ns";

import { ScriptLogger } from "/scripts/logging/scriptLogger";
import { TerminalLogger } from "/scripts/logging/terminalLogger";
import { NoopLooger } from "/scripts/logging/noopLogger";
import { ConsoleLogger } from "/scripts/logging/consoleLogger";

type Logger = ConsoleLogger | ScriptLogger | TerminalLogger | NoopLooger;

enum LoggerMode {
  CONSOLE,
  SCRIPT,
  TERMINAL,
  NOOP
}

class LogWritersManager {
  static readonly loggersMap = new Map<string, ScriptLogger | TerminalLogger>();
  readonly loggerMode: LoggerMode;

  constructor(loggerMode: LoggerMode = LoggerMode.CONSOLE) {
    this.loggerMode = loggerMode;
  }

  public getLogger(netscript: NS, moduleName: string) {
    var logWriter = LogWritersManager.loggersMap.get(moduleName);
    if (!logWriter) {
      if (this.loggerMode === LoggerMode.CONSOLE) {
        logWriter = new ConsoleLogger(netscript, moduleName);
      }
      else if (this.loggerMode === LoggerMode.SCRIPT) {
        logWriter = new ScriptLogger(netscript, moduleName);
      }
      else if (this.loggerMode === LoggerMode.TERMINAL) {
        logWriter = new TerminalLogger(netscript, moduleName);
      }
      else {
        logWriter = new NoopLooger(netscript, moduleName);
      }
      LogWritersManager.loggersMap.set(moduleName, logWriter);
    }
    return logWriter;
  }
}

export {Logger, LoggerMode, LogWritersManager};
