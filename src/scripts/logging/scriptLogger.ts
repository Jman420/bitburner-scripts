import {NS} from '@ns';

const DEFAULT_NETSCRIPT_ENABLED_LOGGING = [
  'weaken',
  'grow',
  'hack',
];

class ScriptLogger {
  readonly netscript: NS;
  readonly moduleName: string;

  constructor(
    netscript: NS,
    moduleName: string,
    netscriptEnabledLogging = DEFAULT_NETSCRIPT_ENABLED_LOGGING
  ) {
    this.netscript = netscript;
    this.moduleName = moduleName;

    this.netscript.disableLog('ALL');
    for (const loggedFunc of netscriptEnabledLogging) {
      this.netscript.enableLog(loggedFunc);
    }
  }

  public writeLine(msg: string) {
    this.netscript.print(msg);
  }
}

export {DEFAULT_NETSCRIPT_ENABLED_LOGGING, ScriptLogger};
