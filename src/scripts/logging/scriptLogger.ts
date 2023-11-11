import {NS} from '@ns';

class ScriptLogger {
  readonly netscript: NS;
  readonly moduleName: string;

  constructor(netscript: NS, moduleName: string) {
    this.netscript = netscript;
    this.moduleName = moduleName;

    const enabledLogging = [
      'weaken',
      'grow',
      'hack',
      'exec',
      'stock.buyStock',
      'stock.buyShort',
      'stock.sellStock',
      'stock.sellShort',
    ];
    this.netscript.disableLog('ALL');
    for (const loggedFunc of enabledLogging) {
      this.netscript.enableLog(loggedFunc);
    }
  }

  public writeLine(msg: string) {
    this.netscript.print(msg);
  }
}

export {ScriptLogger};
