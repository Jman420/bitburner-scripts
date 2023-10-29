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

export {getTotalPaths, getTotalPathsObsticles, minPathTriangle};
