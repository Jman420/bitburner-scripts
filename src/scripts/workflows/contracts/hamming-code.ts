import {isPowerOf2} from '/scripts/common/shared';

function decimalToHammingBinary(decimal: number) {
  const dataArray = decimal.toString(2).split('').map(Number);

  // Determine required parity bits
  let parityBitsRequired = 0;
  while (2 ** parityBitsRequired < dataArray.length + parityBitsRequired + 1) {
    parityBitsRequired++;
  }

  // Copy data into Hamming array
  const hammingArray = new Array<number>(dataArray.length + parityBitsRequired + 1);
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
    let parityBitCounter = 0;
    parityBitCounter < parityBitsRequired;
    parityBitCounter++
  ) {
    let parityBit = parityBinary[parityBitCounter];
    if (parityBitCounter >= parityBinary.length) {
      parityBit = 0;
    }
    hammingArray[2 ** parityBitCounter] = parityBit;
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

export {decimalToHammingBinary, hammingBinaryToDecimal};
