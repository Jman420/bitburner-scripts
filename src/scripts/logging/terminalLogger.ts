import {NS} from '@ns';

class TerminalLogger {
  readonly netscript: NS;
  readonly moduleName: string;

  constructor(netscript: NS, moduleName: string) {
    this.netscript = netscript;
    this.moduleName = moduleName;
  }

  public writeLine(msg: string) {
    this.netscript.tprint(`${msg}`);
  }
}

export {TerminalLogger};
