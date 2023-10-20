import { NS } from "@ns";

import { LogWritersManager } from "/scripts/logging/loggerManager";

type ToolFunction = (server:string) => void;

const logWriterManager = new LogWritersManager();

function obtainRoot(netscript: NS, hostname: string) {
  const logWriter = logWriterManager.getLogger(netscript, 'escalation');
  const ESCALATION_TOOLS: Array<ToolFunction> = [];
  const requiredPorts = netscript.getServerNumPortsRequired(hostname);
  var rootAccess = netscript.hasRootAccess(hostname);

  if (!rootAccess) {
    if (requiredPorts <= ESCALATION_TOOLS.length) {
      logWriter.writeLine('Opening required ports to obtain root access...');
      for (const tool of ESCALATION_TOOLS) {
        tool(hostname);
      }
      netscript.nuke(hostname);
      rootAccess = netscript.hasRootAccess(hostname);
    }
    else {
      logWriter.writeLine('Cannot open required ports to obtain root access.');
    }
  }
  
  return rootAccess;
}

export {obtainRoot};
