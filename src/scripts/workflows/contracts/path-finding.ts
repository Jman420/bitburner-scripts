function getGrid(rowCount: number, columnCount: number, initialValue: number) {
  return new Array<number[]>(rowCount)
    .fill([])
    .map(() => new Array<number>(columnCount).fill(initialValue));
}

function getTotalPaths(rowCount: number, columnCount: number) {
  const grid = getGrid(rowCount, columnCount, 0);
  return getTotalPathsObsticles(grid);
}

function getTotalPathsObsticles(grid: number[][]) {
  const totalRows = grid.length;
  const totalColumns = grid[0].length;
  const pathingGrid = getGrid(totalRows, totalColumns, -1);

  for (let rowCounter = 0; rowCounter < totalRows; rowCounter++) {
    for (let columnCounter = 0; columnCounter < totalColumns; columnCounter++) {
      if (rowCounter === 0 && columnCounter === 0) {
        pathingGrid[rowCounter][columnCounter] = 1;
      } else if (grid[rowCounter][columnCounter] === 1) {
        pathingGrid[rowCounter][columnCounter] = 0;
      } else {
        let pathCount = 0;
        if (rowCounter > 0) {
          pathCount += pathingGrid[rowCounter - 1][columnCounter];
        }
        if (columnCounter > 0) {
          pathCount += pathingGrid[rowCounter][columnCounter - 1];
        }
        pathingGrid[rowCounter][columnCounter] = pathCount;
      }
    }
  }

  return pathingGrid[totalRows - 1][totalColumns - 1];
}

// Note : The algorithm using Math.min() instead of calculating all paths can be easily broken by baiting the algorithm into going down an isolated path which is cheap in the beginning but expensive later on.
//  Improve this algorithm by calculating all paths in the triangle... figure out how to calculate the inner pathValue references
function minPathTriangle(triangel: number[][]) {
  let pathValues = [triangel[0][0]];
  for (let rowCount = 1; rowCount < triangel.length; rowCount++) {
    const rowLength = triangel[rowCount].length;
    const rowSums = new Array<number>();

    // Handle zero column index
    let currentValue = triangel[rowCount][0];
    let leftSum = 0;
    let rightSum = pathValues[0];
    rowSums.push(rightSum + currentValue);

    for (let columnCount = 1; columnCount < rowLength - 1; columnCount++) {
      currentValue = triangel[rowCount][columnCount];
      leftSum = pathValues[columnCount - 1];
      rightSum = pathValues[columnCount];

      rowSums.push(Math.min(leftSum + currentValue, rightSum + currentValue));
    }

    // Handle rowLength column index
    currentValue = triangel[rowCount][rowLength - 1];
    leftSum = pathValues[pathValues.length - 1];
    rightSum = 0;
    rowSums.push(leftSum + currentValue);

    pathValues = rowSums;
  }

  return Math.min(...pathValues);
}

function arrayJumpGame(array: number[]) {
  let result = 0;
  let jumpReach = 0;
  let lastIndex = -1;

  while (jumpReach < array.length - 1) {
    let nextJump = -1;
    for (
      let indexCounter = jumpReach;
      indexCounter > lastIndex;
      indexCounter--
    ) {
      const possibleJump = indexCounter + array[indexCounter];
      if (possibleJump > jumpReach) {
        jumpReach = possibleJump;
        nextJump = indexCounter;
      }
    }

    if (nextJump === -1) {
      result = 0;
      break;
    }

    lastIndex = nextJump;
    result++;
  }

  return result;
}

function spiralizeMatrix(matrix: number[][]) {
  const result = new Array<number>();

  let topRowIndex = 0;
  let rightColumnIndex = matrix[0].length - 1;
  let bottomRowIndex = matrix.length - 1;
  let leftColumnIndex = 0;

  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    for (
      let columnCounter = leftColumnIndex;
      columnCounter <= rightColumnIndex;
      columnCounter++
    ) {
      result.push(matrix[topRowIndex][columnCounter]);
    }
    topRowIndex++;
    if (topRowIndex > bottomRowIndex) {
      break;
    }

    for (
      let rowCounter = topRowIndex;
      rowCounter <= bottomRowIndex;
      rowCounter++
    ) {
      result.push(matrix[rowCounter][rightColumnIndex]);
    }
    rightColumnIndex--;
    if (rightColumnIndex < leftColumnIndex) {
      break;
    }

    for (
      let columnCounter = rightColumnIndex;
      columnCounter >= leftColumnIndex;
      columnCounter--
    ) {
      result.push(matrix[bottomRowIndex][columnCounter]);
    }
    bottomRowIndex--;
    if (bottomRowIndex < topRowIndex) {
      break;
    }

    for (
      let rowCounter = bottomRowIndex;
      rowCounter >= topRowIndex;
      rowCounter--
    ) {
      result.push(matrix[rowCounter][leftColumnIndex]);
    }
    leftColumnIndex++;
    if (leftColumnIndex > rightColumnIndex) {
      break;
    }
  }

  return JSON.stringify(result);
}

export {
  getTotalPaths,
  getTotalPathsObsticles,
  minPathTriangle,
  arrayJumpGame,
  spiralizeMatrix,
};
