import {NS} from '@ns';

function copyFiles(netscript: NS, filePaths: string[], hostname: string) {
  netscript.scp(filePaths, hostname);
}

export {copyFiles};
