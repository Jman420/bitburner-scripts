import {NetscriptPackage} from '/scripts/netscript-services/netscript-ghost';
import {getRequiredRam} from '/scripts/workflows/execution';
import {
  growThreadsRequired,
  hackThreadsRequired,
  weakenThreadsRequired,
} from '/scripts/workflows/formulas';
import {
  GROW_WORKER_SCRIPT,
  HACK_WORKER_SCRIPT,
  WEAKEN_WORKER_SCRIPT,
} from '/scripts/workflows/orchestration';

import {analyzeHost} from '/scripts/workflows/recon';

interface WgwhAttackConfig {
  includeHomeAttacker: boolean;
  optimalOnlyCount: number;
  hackFundsPercent: number;
  targetFundsLimitPercent: number;
  targetHosts: string[];
  attackerHosts: string[];
}

interface AttackBatchConfig {
  maxFundsPercent: number;
  hackFundsPercent: number;
  includeHomeAttacker: boolean;
}

const DEFAULT_OPTIMAL_ONLY_COUNT = 0;
const DEFAULT_HACK_FUNDS_PERCENT = 0.75;
const DEFAULT_TARGET_FUNDS_LIMIT_PERCENT = 1.0;

async function getBatchDetails(
  nsPackage: NetscriptPackage,
  targetHost: string,
  targetMaxFundsPercent: number,
  hackFundsPercent: number
) {
  const nsLocator = nsPackage.ghost;
  const netscript = nsPackage.netscript;

  const hackThreads = await hackThreadsRequired(
    nsPackage,
    targetHost,
    hackFundsPercent
  );
  const hackRam = getRequiredRam(netscript, HACK_WORKER_SCRIPT, hackThreads);

  const targetDetails = analyzeHost(netscript, targetHost);
  const hackSecurityIncrease = await nsLocator['hackAnalyzeSecurity'](
    hackThreads,
    targetHost
  );
  const weakenGrowThreads = await weakenThreadsRequired(
    nsLocator,
    targetDetails.securityLevel +
      hackSecurityIncrease -
      targetDetails.minSecurityLevel
  );
  const weakenGrowRam = getRequiredRam(
    netscript,
    WEAKEN_WORKER_SCRIPT,
    weakenGrowThreads
  );

  const targetMaxFunds = targetDetails.maxFunds * targetMaxFundsPercent;
  const growThreads = await growThreadsRequired(
    nsPackage,
    targetHost,
    targetMaxFunds
  );
  const growRam = getRequiredRam(netscript, GROW_WORKER_SCRIPT, growThreads);

  const growSecurityIncrease = await nsLocator['growthAnalyzeSecurity'](
    growThreads,
    targetHost
  );
  const weakenEndThreads = await weakenThreadsRequired(
    nsLocator,
    growSecurityIncrease
  );
  const weakenEndRam = getRequiredRam(
    netscript,
    WEAKEN_WORKER_SCRIPT,
    weakenEndThreads
  );

  return {
    hackThreads: hackThreads,
    hackRam: hackRam,
    weakenGrowThreads: weakenGrowThreads,
    weakenGrowRam: weakenGrowRam,
    growThreads: growThreads,
    growRam: growRam,
    weakenEndThreads: weakenEndThreads,
    weakenEndRam: weakenEndRam,
    ramPerBatch: weakenGrowRam + growRam + weakenEndRam + hackRam,
  };
}

export {
  WgwhAttackConfig,
  AttackBatchConfig,
  DEFAULT_OPTIMAL_ONLY_COUNT,
  DEFAULT_HACK_FUNDS_PERCENT,
  DEFAULT_TARGET_FUNDS_LIMIT_PERCENT,
  getBatchDetails,
};
