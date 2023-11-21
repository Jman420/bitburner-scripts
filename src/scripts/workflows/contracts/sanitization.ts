function getParenthesisVariants(data: string, char: string) {
  const variants = new Set<string>();
  const charRegEx = new RegExp(`\\${char}`, 'g');
  for (const match of data.matchAll(charRegEx)) {
    const matchIndex = match.index as number;
    const dataUpToMatch = data.slice(0, matchIndex);
    const dataAfterMatch = data.slice(matchIndex + 1);
    variants.add(`${dataUpToMatch}${dataAfterMatch}`);
  }
  return variants;
}

function sanitizeParenthesis(data: string) {
  const unsanitized = data.replace(/^\)+/, '').replace(/\(+$/, '');

  // Fix missing close parenthesis
  const firstChar = unsanitized.charAt(0);
  let unclosedParenthesis = firstChar === '(' ? 1 : 0;
  let closeFixVariants = [firstChar];
  for (let charCounter = 1; charCounter < unsanitized.length; charCounter++) {
    const currentChar = unsanitized.charAt(charCounter);
    if (currentChar === ')' && unclosedParenthesis <= 0) {
      const newVariants = new Set<string>();
      for (const fixVariant of closeFixVariants) {
        getParenthesisVariants(`${fixVariant}${currentChar}`, currentChar).forEach(value => newVariants.add(value));
      }
      closeFixVariants = [...newVariants];
      continue;
    }
    
    if (currentChar === ')') {
      unclosedParenthesis--;
    }
    else if (currentChar === '(') {
      unclosedParenthesis++;
    }
    closeFixVariants = closeFixVariants.map(value => `${value}${currentChar}`);
  }

  // Fix missing open parenthesis
  const result = [];
  for (let closeVariant of closeFixVariants) {
    const lastChar = closeVariant.charAt(closeVariant.length - 1);
    let unopenedParenthesis = lastChar === ')' ? 1 : 0;
    let openFixVariants = [lastChar];
    for (let charCounter = closeVariant.length - 2; charCounter >= 0; charCounter--) {
      const currentChar = closeVariant.charAt(charCounter);
      if (currentChar === '(' && unopenedParenthesis <= 0) {
        const newVariants = new Set<string>();
        for (const fixVariant of openFixVariants) {
          getParenthesisVariants(`${currentChar}${fixVariant}`, currentChar).forEach(value => newVariants.add(value));
        }
        openFixVariants = [...newVariants];
        continue;
      }

      if (currentChar === ')') {
        unopenedParenthesis++;
      }
      else if (currentChar === '(') {
        unopenedParenthesis--;
      }
      openFixVariants = openFixVariants.map(value => `${currentChar}${value}`);
    }

    result.push(...openFixVariants);
  }

  return JSON.stringify(result);
}

export {sanitizeParenthesis};
