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

export {getTotalPaths, getTotalPathsObsticles};
