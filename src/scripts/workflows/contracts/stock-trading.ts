function maxProfit(stockPrices: number[], maxTransactions?: number) {
  if (stockPrices.length < 2) {
    return 0;
  }

  let maxProfit = 0;
  if (!maxTransactions || maxTransactions > stockPrices.length / 2) {
    for (
      let priceCounter = 0;
      priceCounter < stockPrices.length - 1;
      priceCounter++
    ) {
      maxProfit += Math.max(
        0,
        stockPrices[priceCounter + 1] - stockPrices[priceCounter]
      );
    }
  } else {
    // Adapted from https://github.com/Drakmyth/BitburnerScripts/blob/master/src/contracts/algorithmic-stock-trader.ts
    const rele = Array<number>(maxTransactions + 1).fill(0);
    const hold = Array<number>(maxTransactions + 1).fill(
      Number.MIN_SAFE_INTEGER
    );

    for (
      let priceCounter = 0;
      priceCounter < stockPrices.length;
      priceCounter++
    ) {
      const price = stockPrices[priceCounter];
      for (
        let transCounter = maxTransactions;
        transCounter > 0;
        transCounter--
      ) {
        rele[transCounter] = Math.max(
          rele[transCounter],
          hold[transCounter] + price
        );
        hold[transCounter] = Math.max(
          hold[transCounter],
          rele[transCounter - 1] - price
        );
      }
    }
    maxProfit = rele[maxTransactions];
  }
  return maxProfit;
}

export {maxProfit};
