import {CodingContractData, NS} from '@ns';

import {scanWideNetwork} from '/scripts/workflows/recon';

import {rotationCipher} from '/scripts/workflows/contracts/rotation-cipher';
import {
  decimalToHammingBinary,
  hammingBinaryToDecimal,
} from '/scripts/workflows/contracts/hamming-code';
import {
  getTotalPaths,
  getTotalPathsObsticles,
} from '/scripts/workflows/contracts/path-finding';

type ParseInputFunction = (data: CodingContractData) => any[];
type SolutionFunction = (...args: any) => string | number;
type ChallengeSolution = string | number | any[];

interface CodingContract {
  hostname: string;
  filename: string;
  type: string;
  data: any;
  attemptsRemaining: number;
}

class ContractSolver {
  readonly parseInputFunc: ParseInputFunction;
  readonly solveFunc: SolutionFunction;

  constructor(
    solveFunc: SolutionFunction,
    parseInputFunc: ParseInputFunction = data => [data]
  ) {
    this.solveFunc = solveFunc;
    this.parseInputFunc = parseInputFunc;
  }
}

const CONTRACT_FILE_EXTENSION = '.cct';
const CONTRACT_SOLUTION_MAP = new Map<string, ContractSolver>([
  [
    'Encryption I: Caesar Cipher',
    new ContractSolver(rotationCipher, data => [...data]),
  ],
  [
    'HammingCodes: Integer to Encoded Binary',
    new ContractSolver(decimalToHammingBinary),
  ],
  [
    'HammingCodes: Encoded Binary to Integer',
    new ContractSolver(hammingBinaryToDecimal),
  ],
  [
    'Unique Paths in a Grid I',
    new ContractSolver(getTotalPaths, data => [...data]),
  ],
  ['Unique Paths in a Grid II', new ContractSolver(getTotalPathsObsticles)],
]);

function findContracts(
  netscript: NS,
  includeHome = false,
  targetHosts?: string[]
) {
  const availableContracts = new Array<CodingContract>();
  if (!targetHosts || targetHosts.length < 1) {
    targetHosts = scanWideNetwork(netscript, includeHome);
  }
  for (const hostname of targetHosts) {
    const challengeFiles = netscript.ls(hostname, CONTRACT_FILE_EXTENSION);
    for (const challengePath of challengeFiles) {
      availableContracts.push({
        hostname: hostname,
        filename: challengePath,
        type: netscript.codingcontract.getContractType(challengePath, hostname),
        data: netscript.codingcontract.getData(challengePath, hostname),
        attemptsRemaining: netscript.codingcontract.getNumTriesRemaining(
          challengePath,
          hostname
        ),
      });
    }
  }
  return availableContracts;
}

function getContractSolver(contract: CodingContract) {
  return CONTRACT_SOLUTION_MAP.get(contract.type);
}

export {
  CodingContract,
  SolutionFunction,
  ChallengeSolution,
  CONTRACT_SOLUTION_MAP,
  rotationCipher,
  decimalToHammingBinary,
  hammingBinaryToDecimal,
  findContracts,
  getContractSolver,
};
