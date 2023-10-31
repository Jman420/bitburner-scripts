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

  const result = new Array<number[]>();
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

export {largestPrimeFactor, mergeOverlappingItervals, totalWaysToSum};
