function rleCompression(plaintext: string) {
  let result = '';

  let prevChar = plaintext[0];
  let repeatCount = 1;
  for (let charCounter = 1; charCounter < plaintext.length; charCounter++) {
    const currentChar = plaintext[charCounter];
    if (currentChar === prevChar && repeatCount < 9) {
      repeatCount++;
    }
    else {
      result += `${repeatCount}${prevChar}`;
      prevChar = currentChar;
      repeatCount = 1;
    }
  }

  result += `${repeatCount}${prevChar}`;
  return result;
}

function lzDecompression(compressedData: string) {
  let result = '';

  let charCounter = 0;
  while (charCounter < compressedData.length) {
    // Chunk Type 1 - Exactly L characters, which are to be copied directly into the uncompressed data.
    let chunkLength = parseInt(compressedData[charCounter]);
    charCounter++;
    if (chunkLength > 0) {
      result += compressedData.slice(charCounter, charCounter + chunkLength);
      charCounter += chunkLength;
    }

    if (chunkLength >= compressedData.length) {
      break;
    }

    // Chunk Type 2 - A reference to an earlier part of the uncompressed data. To do this, the length is followed by a second ASCII digit X: each of the L output characters is a copy of the character X places before it in the uncompressed data.
    chunkLength = parseInt(compressedData[charCounter]);
    charCounter++;
    if (chunkLength > 0) {
      const offset = parseInt(compressedData[charCounter]);
      charCounter++;
      for (let repeatCounter = 0; repeatCounter < chunkLength; repeatCounter++) {
        result += result[result.length - offset];
      }
    }
  }

  return result;
}

export {rleCompression, lzDecompression};
