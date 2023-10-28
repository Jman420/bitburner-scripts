import {NS} from '@ns';
import {scanWideNetwork} from '/scripts/workflows/recon';

type SolutionFunction = (...args: any) => string | number;
type ChallengeSolution = string | number | any[];

interface CodingContract {
  hostname: string;
  filename: string;
  type: string;
  data: any;
  attemptsRemaining: number;
}

const CONTRACT_FILE_EXTENSION = '.cct';
const CONTRACT_SOLUTION_MAP = new Map<string, SolutionFunction>([
  ['Encryption I: Caesar Cipher', rotationCipher],
  ['HammingCodes: Integer to Encoded Binary', decimalToHammingBinary],
  ['HammingCodes: Encoded Binary to Integer', hammingBinaryToDecimal],
]);

function rotationCipher(originalText: string, alphaShift: number) {
  // All Rotation Cipher Coding Contracts involve left-shifting rather than right
  alphaShift = -alphaShift;
  if (alphaShift < 0) {
    // Wrap the shift amount around the alphabet (ie. a shift of -3 is the same as a shift of 23 because 26 chars in ascii alphabet)
    alphaShift += 26;
  }

  const charCodeA = 'A'.charCodeAt(0);
  const charCodeZ = 'Z'.charCodeAt(0);
  let resultText = '';
  for (let char of originalText) {
    if (char !== ' ') {
      const charCode = char.charCodeAt(0);
      let shiftCharCode = charCode + alphaShift;
      if (shiftCharCode > charCodeZ) {
        // Wrap the shifted char code around the alphabet (we use charCodeA - 1 to ensure our first used character is A)
        shiftCharCode = ((charCode + alphaShift) % charCodeZ) + (charCodeA - 1);
      }
      char = String.fromCharCode(shiftCharCode);
    }
    resultText += char;
  }

  return resultText;
}

function isPowerOf2(value: number) {
  return Math.log2(value) % 1 === 0;
}

function decimalToHammingBinary(decimal: number) {
  const dataArray = decimal.toString(2).split('').map(Number);

  // Determine required parity bits
  let parityBitsRequired = 0;
  while (2 ** parityBitsRequired <= dataArray.length + parityBitsRequired + 1) {
    parityBitsRequired++;
  }

  // Copy data into Hamming array
  const hammingArray = new Array<number>(dataArray.length + parityBitsRequired);
  let hammingIndexCounter = 0;
  for (const dataBit of dataArray) {
    // Parity bits are in indexes at powers of 2
    while (hammingIndexCounter === 0 || isPowerOf2(hammingIndexCounter)) {
      hammingArray[hammingIndexCounter] = 0;
      hammingIndexCounter++;
    }

    hammingArray[hammingIndexCounter] = dataBit;
    hammingIndexCounter++;
  }

  // Calculate parity bits
  const parityDecimal = hammingArray.reduce(
    (accumulator, value, index) => (accumulator ^= value > 0 ? index : 0),
    0
  );
  const parityBinary = parityDecimal
    .toString(2)
    .split('')
    .reverse()
    .map(Number);
  for (
    let parityBitCounter = 1;
    parityBitCounter <= parityBitsRequired;
    parityBitCounter++
  ) {
    hammingArray[2 ** parityBitCounter] = parityBinary[parityBitCounter];
  }

  // Calculate block parity bit
  hammingArray[0] = hammingArray.reduce(
    (accumulator, value) => accumulator ^ value
  );

  return hammingArray.join('');
}

function hammingBinaryToDecimal(hammingCode: string) {
  const hammingArray = hammingCode.split('').map(Number);

  // Block parity error indicates if an error exists
  const blockParityError = Boolean(
    hammingArray.reduce((accumulator, value) => accumulator + value) % 2
  );
  // Error index indicates which index has the error
  const errorIndex = hammingArray.reduce(
    (accumulator, value, index) => (value ? accumulator ^ index : accumulator),
    0
  );

  // Correct identified error
  if (blockParityError && errorIndex) {
    hammingArray[errorIndex] = Number(!hammingArray[errorIndex]);
  }

  // Extract and parse data bits
  const dataArray = new Array<Number>();
  hammingArray.forEach((value, index) =>
    index !== 0 && !isPowerOf2(index) ? dataArray.push(value) : false
  );
  return parseInt(dataArray.join(''), 2);
}

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

function getContractSolutionFunc(contract: CodingContract) {
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
  getContractSolutionFunc,
};
