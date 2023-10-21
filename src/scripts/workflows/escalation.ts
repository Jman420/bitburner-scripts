import { NS } from "@ns";

import { LogWritersManager } from "/scripts/logging/loggerManager";
import { HOME_SERVER_NAME } from "/scripts/workflows/shared";

type ToolFunction = (server:string) => void;

function obtainRoot(netscript: NS, hostname: string) {
  const logWriter = new LogWritersManager().getLogger(netscript, `escalation.${obtainRoot.name}`);
  const ESCALATION_TOOLS = new Map<string, ToolFunction>([['BruteSSH.exe', netscript.brutessh], ['FTPCrack.exe', netscript.ftpcrack]]);
  var rootAccess = netscript.hasRootAccess(hostname);

  if (!rootAccess) {
    const requiredPorts = netscript.getServerNumPortsRequired(hostname);
    if (requiredPorts <= ESCALATION_TOOLS.size) {
      logWriter.writeLine('Opening required ports to obtain root access...');
      for (const [toolexe, tool] of ESCALATION_TOOLS) {
        if (netscript.fileExists(toolexe, HOME_SERVER_NAME)){
          tool(hostname);
        }
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
