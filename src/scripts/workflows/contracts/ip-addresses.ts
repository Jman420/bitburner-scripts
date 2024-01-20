function generateIpAddresses(digits: string) {
  const result = [];

  for (let index1 = 1; index1 <= 3; index1++) {
    for (let index2 = 1; index2 <= 3; index2++) {
      for (let index3 = 1; index3 <= 3; index3++) {
        for (let index4 = 1; index4 <= 3; index4++) {
          if (index1 + index2 + index3 + index4 === digits.length) {
            const octet1 = parseInt(digits.substring(0, index1));
            const octet2 = parseInt(digits.substring(index1, index1 + index2));
            const octet3 = parseInt(
              digits.substring(index1 + index2, index1 + index2 + index3)
            );
            const octet4 = parseInt(
              digits.substring(index1 + index2 + index3, digits.length)
            );

            if (
              octet1 <= 255 &&
              octet2 <= 255 &&
              octet3 <= 255 &&
              octet4 <= 255
            ) {
              result.push(`${octet1}.${octet2}.${octet3}.${octet4}`);
            }
          }
        }
      }
    }
  }

  return JSON.stringify(result);
}

export {generateIpAddresses};
