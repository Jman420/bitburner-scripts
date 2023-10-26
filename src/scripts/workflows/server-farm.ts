type PurchaseFunction = (hostname: string, ram: number) => boolean | string;

interface ServerFarmOrder {
  hostname: string;
  ramAmount: number;
  cost: number;
  purchaseFunc: PurchaseFunction;
}

// Taken from : https://www.geeksforgeeks.org/smallest-power-of-2-greater-than-or-equal-to-n/#
// Function to find the smallest power of 2
// greater than or equal to value
function nearestPowerOf2(value: number) {
  // Calculate log2 of value
  const power = Math.floor(Math.log2(value));

  // If 2^power is equal to value, return value
  if (Math.pow(2, power) === value) {
    return value;
  }

  // Return 2^(power + 1)
  return Math.pow(2, power + 1);
}

export {ServerFarmOrder, nearestPowerOf2};
