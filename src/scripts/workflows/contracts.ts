import {CodingContractData} from '@ns';

import {NetscriptPackage} from '/scripts/netscript-services/netscript-ghost';

import {scanWideNetwork} from '/scripts/workflows/recon';

import {
  caesarCipher,
  vigenereCipher,
} from '/scripts/workflows/contracts/encryption';
import {
  decimalToHammingBinary,
  hammingBinaryToDecimal,
} from '/scripts/workflows/contracts/hamming-code';
import {
  arrayJumpGame,
  getTotalPaths,
  getTotalPathsObsticles,
  minPathTriangle,
  spiralizeMatrix,
} from '/scripts/workflows/contracts/path-finding';
import {maxProfit} from '/scripts/workflows/contracts/stock-trading';
import {
  lzDecompression,
  rleCompression,
} from '/scripts/workflows/contracts/compression';
import {
  findValidExpressions,
  largestPrimeFactor,
  mergeOverlappingItervals,
  subarrayMaxSum,
  totalWaysToSum,
} from '/scripts/workflows/contracts/math';
import {generateIpAddresses} from '/scripts/workflows/contracts/ip-addresses';
import {sanitizeParenthesis} from '/scripts/workflows/contracts/sanitization';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type ParseInputFunction = (data: CodingContractData) => any[];
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type SolutionFunction = (...args: any) => string | number;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type ChallengeSolution = string | number | any[];

interface CodingContract {
  hostname: string;
  filename: string;
  type: string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
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
  ['Find Largest Prime Factor', new ContractSolver(largestPrimeFactor)],
  ['Subarray with Maximum Sum', new ContractSolver(subarrayMaxSum)],
  [
    'Total Ways to Sum',
    new ContractSolver(totalWaysToSum, data => [
      data,
      [...Array(data).keys()].slice(1),
    ]),
  ],
  ['Total Ways to Sum II', new ContractSolver(totalWaysToSum, data => data)],
  ['Spiralize Matrix', new ContractSolver(spiralizeMatrix)],
  [
    'Array Jumping Game',
    new ContractSolver(data => (arrayJumpGame(data) > 0 ? 1 : 0)),
  ],
  ['Array Jumping Game II', new ContractSolver(arrayJumpGame)],
  ['Merge Overlapping Intervals', new ContractSolver(mergeOverlappingItervals)],
  ['Generate IP Addresses', new ContractSolver(generateIpAddresses)],
  [
    'Algorithmic Stock Trader I',
    new ContractSolver(maxProfit, data => [data, 1]),
  ],
  ['Algorithmic Stock Trader II', new ContractSolver(maxProfit)],
  [
    'Algorithmic Stock Trader III',
    new ContractSolver(maxProfit, data => [data, 2]),
  ],
  [
    'Algorithmic Stock Trader IV',
    new ContractSolver(maxProfit, data => [data[1], data[0]]),
  ],
  ['Minimum Path Sum in a Triangle', new ContractSolver(minPathTriangle)],
  [
    'Unique Paths in a Grid I',
    new ContractSolver(getTotalPaths, data => [...data]),
  ],
  ['Unique Paths in a Grid II', new ContractSolver(getTotalPathsObsticles)],
  [
    'Sanitize Parentheses in Expression',
    new ContractSolver(sanitizeParenthesis, data => [data]),
  ],
  [
    'Find All Valid Math Expressions',
    new ContractSolver(data =>
      JSON.stringify(findValidExpressions(data[0], data[1], 0, '', 0, 0, []))
    ),
  ],
  [
    'HammingCodes: Integer to Encoded Binary',
    new ContractSolver(decimalToHammingBinary),
  ],
  [
    'HammingCodes: Encoded Binary to Integer',
    new ContractSolver(hammingBinaryToDecimal),
  ],
  ['Compression I: RLE Compression', new ContractSolver(rleCompression)],
  ['Compression II: LZ Decompression', new ContractSolver(lzDecompression)],
  [
    'Encryption I: Caesar Cipher',
    new ContractSolver(caesarCipher, data => [...data]),
  ],
  [
    'Encryption II: Vigenère Cipher',
    new ContractSolver(vigenereCipher, data => [...data]),
  ],
]);

async function findContracts(
  nsPackage: NetscriptPackage,
  includeHome = false,
  targetHosts?: string[]
) {
  const nsLocator = nsPackage.ghost;
  const netscript = nsPackage.netscript;
  const contractApi = nsLocator.codingcontract;

  const availableContracts = [];
  if (!targetHosts || targetHosts.length < 1) {
    targetHosts = scanWideNetwork(netscript, {includeHome: includeHome});
  }
  for (const hostname of targetHosts) {
    const challengeFiles = netscript.ls(hostname, CONTRACT_FILE_EXTENSION);
    for (const challengePath of challengeFiles) {
      availableContracts.push({
        hostname: hostname,
        filename: challengePath,
        type: await contractApi['getContractType'](challengePath, hostname),
        data: await contractApi['getData'](challengePath, hostname),
        attemptsRemaining: await contractApi['getNumTriesRemaining'](
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
  CONTRACT_FILE_EXTENSION,
  CONTRACT_SOLUTION_MAP,
  findContracts,
  getContractSolver,
};
