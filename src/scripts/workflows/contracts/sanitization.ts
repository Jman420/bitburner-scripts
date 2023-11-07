function getVariations(unsanitizedStr: string, brokenChar: string) {}

function sanitizeParenthesis(unsanitizedParenthesis: string) {
  // Remove broken leading & trailing parenthesis
  unsanitizedParenthesis = unsanitizedParenthesis
    .replace(/^\)+/, '')
    .replace(/\(+$/, '');

  // Fix open parenthesis

  return '';
}

export {sanitizeParenthesis};
