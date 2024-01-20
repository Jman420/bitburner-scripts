export const FactionData: {
  [FactionName: string]: {
    name: string;
    server?: string;
    gangEligible?: boolean;
  };
} = {
  // Hacking
  CyberSec: {
    name: 'CyberSec',
    server: 'CSEC',
  },
  NiteSec: {
    name: 'NiteSec',
    server: 'avmnite-02h',
  },
  'The Black Hand': {
    name: 'The Black Hand',
    server: 'I.I.I.I',
  },
  BitRunners: {
    name: 'BitRunners',
    server: 'run4theh111z',
  },

  // Crime
  'Slum Snakes': {
    name: 'Slum Snakes',
    gangEligible: true,
  },
  Tetrads: {
    name: 'Tetrads',
    gangEligible: true,
  },

  // End Game
  Daedalus: {
    name: 'Daedalus',
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
  },
  'Shadows of Anarchy': {
    name: 'Shadows of Anarchy',
  },
};
