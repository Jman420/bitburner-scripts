export const FactionData: {
  [FactionName: string]: {
    name: string;
    city?: string;
    server?: string;
    gangEligible?: boolean;
    criticalPath?: boolean;
  };
} = {
  // Hacking
  CyberSec: {
    name: 'CyberSec',
    server: 'CSEC',
    criticalPath: true,
  },
  NiteSec: {
    name: 'NiteSec',
    server: 'avmnite-02h',
    criticalPath: true,
  },
  'The Black Hand': {
    name: 'The Black Hand',
    server: 'I.I.I.I',
    criticalPath: true,
  },
  BitRunners: {
    name: 'BitRunners',
    server: 'run4theh111z',
    criticalPath: true,
  },

  // Crime
  'Slum Snakes': {
    name: 'Slum Snakes',
    city: 'Sector-12',
    gangEligible: true,
  },
  Tetrads: {
    name: 'Tetrads',
    city: 'New Tokyo',
    gangEligible: true,
  },

  // End Game
  Daedalus: {
    name: 'Daedalus',
    criticalPath: true,
  },
  'The Covenant': {
    name: 'The Covenant',
  },
  Illuminati: {
    name: 'Illuminati',
  },

  // Misc
  Netburners: {
    name: 'Netburners',
  },
  'Tian Di Hui': {
    name: 'Tian Di Hui',
    city: 'New Tokyo',
  },
  'Shadows of Anarchy': {
    name: 'Shadows of Anarchy',
  },
};
