const ALPHA_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function caesarCipher(originalText: string, alphaShift: number) {
  // All Rotation Cipher Coding Contracts involve left-shifting rather than right
  alphaShift = -alphaShift;
  if (alphaShift < 0) {
    // Wrap the shift amount around the alphabet (ie. a shift of -3 is the same as a shift of 23 because 26 chars in ascii alphabet)
    alphaShift += 26;
  }

  let resultText = '';
  for (let char of originalText) {
    const charIndex = ALPHA_CHARS.indexOf(char);
    if (charIndex > -1) {
      const shiftedIndex = (charIndex + alphaShift) % ALPHA_CHARS.length;
      char = ALPHA_CHARS[shiftedIndex];
    }
    resultText += char;
  }

  return resultText;
}

function vigenereCipher(originalText: string, keyword: string) {
  let result = '';
  for (let charCounter = 0; charCounter < originalText.length; charCounter++) {
    const shift = ALPHA_CHARS.indexOf(keyword[charCounter % keyword.length]);
    const shiftedIndex =
      (ALPHA_CHARS.indexOf(originalText[charCounter]) + shift) %
      ALPHA_CHARS.length;
    result += ALPHA_CHARS[shiftedIndex];
  }

  return result;
}

export {caesarCipher, vigenereCipher};
