export const ProgramData: {
  [ProgramName: string]: {
    name: string;
    hackLevel: number;
  };
} = {
  BruteSSH: {
    name: 'BruteSSH.exe',
    hackLevel: 50,
  },
  FTPCrack: {
    name: 'FTPCrack.exe',
    hackLevel: 100,
  },
  relaySMTP: {
    name: 'relaySMTP.exe',
    hackLevel: 250,
  },
  HTTPWorm: {
    name: 'HTTPWorm.exe',
    hackLevel: 500,
  },
  SQLInject: {
    name: 'SQLInject.exe',
    hackLevel: 750,
  },
};
