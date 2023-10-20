import { NS } from "@ns";

class NoopLooger {
  readonly netscript: NS;
  readonly moduleName: string;

  constructor(netscript: NS, moduleName: string) {
    this.netscript = netscript;
    this.moduleName = moduleName;
  }

  public writeLine(msg: string) {}
}

export {NoopLooger};
