import {NS} from '@ns';

import {getLogger} from '/scripts/logging/loggerManager';
import {HOME_SERVER_NAME} from '/scripts/common/shared';

type ToolFunction = (server: string) => void;

function getRootTools(netscript: NS) {
  const ESCALATION_TOOLS = new Map<string, ToolFunction>([
    ['BruteSSH.exe', netscript.brutessh],
    ['FTPCrack.exe', netscript.ftpcrack],
    ['relaySMTP.exe', netscript.relaysmtp],
    ['HTTPWorm.exe', netscript.httpworm],
    ['SQLInject.exe', netscript.sqlinject],
  ]);

  const availableTools = new Array<ToolFunction>();
  for (const [toolexe, tool] of ESCALATION_TOOLS) {
    if (netscript.fileExists(toolexe, HOME_SERVER_NAME)) {
      availableTools.push(tool);
    }
  }
  return availableTools;
}

function obtainRoot(netscript: NS, hostname: string) {
  const logWriter = getLogger(netscript, `escalation.${obtainRoot.name}`);
  let rootAccess = netscript.hasRootAccess(hostname);

  if (!rootAccess) {
    const requiredPorts = netscript.getServerNumPortsRequired(hostname);
    const availableTools = getRootTools(netscript);
    if (requiredPorts <= availableTools.length) {
      logWriter.writeLine('Opening required ports to obtain root access...');
      for (
        let toolCounter = 0;
        toolCounter < availableTools.length && toolCounter < requiredPorts;
        toolCounter++
      ) {
        const toolFunc = availableTools[toolCounter];
        toolFunc(hostname);
      }
      netscript.nuke(hostname);
      rootAccess = netscript.hasRootAccess(hostname);
    } else {
      logWriter.writeLine('Cannot open required ports to obtain root access.');
    }
  }

  return rootAccess;
}

export {getRootTools, obtainRoot};
