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

export {rotationCipher};
