function largestPrimeFactor(target: number) {
  let factor: number;
  for (factor = 2; target > (factor - 1) ** 2; factor++) {
    while (target % factor === 0) {
      target = Math.round(target / factor);
    }
  }

  return target === 1 ? factor - 1 : target;
}

function mergeOverlappingItervals(intervals: number[][]) {
  intervals.sort((val1, val2) => val1[0] - val2[0]);

  const result = [];
  let start = intervals[0][0];
  let end = intervals[0][1];
  for (
    let intervalCounter = 1;
    intervalCounter < intervals.length;
    intervalCounter++
  ) {
    const currentInterval = intervals[intervalCounter];
    if (currentInterval[0] <= end) {
      end = Math.max(end, currentInterval[1]);
    } else {
      result.push([start, end]);
      start = currentInterval[0];
      end = currentInterval[1];
    }
  }
  result.push([start, end]);

  return JSON.stringify(result);
}

function totalWaysToSum(target: number, addends: number[]) {
  const results = new Array<number>(target + 1);
  results[0] = 1;
  results.fill(0, 1);
  for (let addendCounter = 0; addendCounter < addends.length; addendCounter++) {
    for (let addend = addends[addendCounter]; addend <= target; addend++) {
      results[addend] += results[addend - addends[addendCounter]];
    }
  }

  return results[target];
}

function subarrayMaxSum(values: number[]) {
  const sums = values.slice();
  for (let valueCounter = 1; valueCounter < sums.length; valueCounter++) {
    sums[valueCounter] = Math.max(
      sums[valueCounter],
      sums[valueCounter] + sums[valueCounter - 1]
    );
  }

  return Math.max(...sums);
}

function findValidExpressions(
  values: string,
  target: number,
  valuesPosition: number,
  expression: string,
  expressionValue: number,
  multipliedCarry: number,
  results: string[]
) {
  if (valuesPosition >= values.length) {
    if (expressionValue === target) {
      results.push(expression);
    }
    return results;
  }

  for (
    let valueCounter = valuesPosition;
    valueCounter < values.length;
    valueCounter++
  ) {
    if (valueCounter !== valuesPosition && values[valuesPosition] === '0') {
      break;
    }

    const currentValue = parseInt(
      values.substring(valuesPosition, valueCounter + 1)
    );
    if (valuesPosition === 0) {
      findValidExpressions(
        values,
        target,
        valueCounter + 1,
        `${expression}${currentValue}`,
        currentValue,
        currentValue,
        results
      );
    } else {
      findValidExpressions(
        values,
        target,
        valueCounter + 1,
        `${expression}+${currentValue}`,
        expressionValue + currentValue,
        currentValue,
        results
      );
      findValidExpressions(
        values,
        target,
        valueCounter + 1,
        `${expression}-${currentValue}`,
        expressionValue - currentValue,
        -currentValue,
        results
      );
      findValidExpressions(
        values,
        target,
        valueCounter + 1,
        `${expression}*${currentValue}`,
        expressionValue - multipliedCarry + multipliedCarry * currentValue,
        multipliedCarry * currentValue,
        results
      );
    }
  }

  return results;
}

export {
  largestPrimeFactor,
  mergeOverlappingItervals,
  totalWaysToSum,
  subarrayMaxSum,
  findValidExpressions,
};
