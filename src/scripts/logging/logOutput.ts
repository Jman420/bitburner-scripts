import {ScriptLogger} from '/scripts/logging/scriptLogger';
import {TerminalLogger} from '/scripts/logging/terminalLogger';
import {ServerDetails} from '/scripts/workflows/recon';

const LOG_WINDOW_CHAR_WIDTH = 50;
const SECTION_DIVIDER = '*'.repeat(LOG_WINDOW_CHAR_WIDTH);
const ENTRY_DIVIDER = '-'.repeat(LOG_WINDOW_CHAR_WIDTH);

function logServerDetails(
  logWriter: ScriptLogger | TerminalLogger,
  serverDetails: ServerDetails
) {
  logWriter.writeLine(`  Security Level : ${serverDetails.securityLevel}`);
  logWriter.writeLine(
    `  Min Security Level : ${serverDetails.minSecurityLevel}`
  );
  logWriter.writeLine(`  Ports Required : ${serverDetails.requiredPorts}`);
  logWriter.writeLine(`  Hack Level : ${serverDetails.requiredLevel}`);
  logWriter.writeLine(`  Maximum Funds : ${serverDetails.maxFunds}`);
  logWriter.writeLine(`  Available Funds : ${serverDetails.availableFunds}`);
  logWriter.writeLine(`  Root Access : ${serverDetails.rootAccess}`);
}

export {SECTION_DIVIDER, ENTRY_DIVIDER, logServerDetails};
