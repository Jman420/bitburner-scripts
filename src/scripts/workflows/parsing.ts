// Copied from game source code : https://github.com/bitburner-official/bitburner-src/blob/stable/src/ui/formatNumber.ts#L5
const NUMBER_SUFFIX_LIST = [
  '',
  'k',
  'm',
  'b',
  't',
  'q',
  'Q',
  's',
  'S',
  'o',
  'n',
];

function parseNumber(value: string) {
  value = value.trim();
  value = value.replaceAll(',', '');

  // Handle special returns
  if (['infinity', 'Infinity', '∞'].includes(value)) return Infinity;
  if (['-infinity', '-Infinity', '-∞'].includes(value)) return -Infinity;

  const suffixIndex = NUMBER_SUFFIX_LIST.indexOf(
    value.substring(value.length - 1)
  );
  if (suffixIndex < 0) {
    return parseFloat(value);
  }
  return parseFloat(
    `${value.substring(0, value.length - 1)}e${suffixIndex * 3}`
  );
}

export {parseNumber};
