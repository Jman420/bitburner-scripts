function largestPrimeFactor(target: number) {
  let factor: number;
  for (factor = 2; target > (factor - 1) ** 2; factor++) {
    while (target % factor === 0) {
      target = Math.round(target / factor);
    }
  }

  return target === 1 ? factor - 1 : target;
}

export {largestPrimeFactor};
