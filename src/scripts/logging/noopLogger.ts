import {NS} from '@ns';

class NoopLooger {
  readonly netscript: NS;
  readonly moduleName: string;

  constructor(netscript: NS, moduleName: string) {
    this.netscript = netscript;
    this.moduleName = moduleName;
  }

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  public writeLine(msg: string) {}
}

export {NoopLooger};
