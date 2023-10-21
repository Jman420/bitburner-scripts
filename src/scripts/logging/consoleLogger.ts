import {NS} from '@ns';

class ConsoleLogger {
  readonly netscript: NS;
  readonly moduleName: string;

  constructor(netscript: NS, moduleName: string) {
    this.netscript = netscript;
    this.moduleName = moduleName;
  }

  public writeLine(msg: string) {
    console.log(`${this.moduleName} - ${msg}`);
  }
}

export {ConsoleLogger};
