interface WgwhAttackConfig {
  includeHomeAttacker: boolean;
  optimalOnlyCount: number;
  hackFundsPercent: number;
  targetFundsLimitPercent: number;
  targetHosts: string[];
  attackerHosts: string[];
}

interface AttackBatchConfig {
  includeHomeAttacker: boolean;
  hackFundsPercent: number;
  fundsMaxPercent: number;
}

const DEFAULT_OPTIMAL_ONLY_COUNT = 0;
const DEFAULT_HACK_FUNDS_PERCENT = 0.75;
const DEFAULT_TARGET_FUNDS_LIMIT_PERCENT = 1.0;

export {
  WgwhAttackConfig,
  AttackBatchConfig,
  DEFAULT_OPTIMAL_ONLY_COUNT,
  DEFAULT_HACK_FUNDS_PERCENT,
  DEFAULT_TARGET_FUNDS_LIMIT_PERCENT,
};
