import {NS} from '@ns';

import {ServerDetails} from '/scripts/workflows/recon';

interface ServerDetailsExtended extends ServerDetails {
  expGain?: number;
}

type ScoringFunction = (
  targetDetails: ServerDetailsExtended,
  meanScoreValues: MeanScoreValues,
  deviationScoreValues: DeviationScoreValues,
  weightScoreValues: WeightScoreValues
) => number;

interface MeanScoreValues {
  hackLevel: number;
  hackTime: number;
  maxFunds: number;
  growRate: number;
  growTime: number;
  weakenTime: number;
  expGain: number;
}

interface DeviationScoreValues {
  hackLevel: number;
  hackTime: number;
  maxFunds: number;
  growRate: number;
  growTime: number;
  weakenTime: number;
  expGain: number;
}

interface WeightScoreValues {
  hackTime: number;
  maxFunds: number;
  growRate: number;
  growTime: number;
  weakenTime: number;
  expGain: number;
}

function getMeanScoreValues(
  targetsAnalysis: ServerDetailsExtended[]
): MeanScoreValues {
  const accumulator = {
    hackLevel: 0,
    hackTime: 0,
    maxFunds: 0,
    growRate: 0,
    growTime: 0,
    weakenTime: 0,
    expGain: 0,
  };
  targetsAnalysis.forEach(value => {
    accumulator.hackLevel += value.hackLevel;
    accumulator.hackTime += value.hackTime;
    accumulator.maxFunds += value.maxFunds;
    accumulator.growRate += value.growRate;
    accumulator.growTime += value.growTime;
    accumulator.weakenTime += value.weakenTime;
    accumulator.expGain += value.expGain ?? 0;
  });
  const totalElements = targetsAnalysis.length;
  return {
    hackLevel: accumulator.hackLevel / totalElements,
    hackTime: accumulator.hackTime / totalElements,
    maxFunds: accumulator.maxFunds / totalElements,
    growRate: accumulator.growRate / totalElements,
    growTime: accumulator.growTime / totalElements,
    weakenTime: accumulator.weakenTime / totalElements,
    expGain: accumulator.expGain / totalElements,
  };
}

function getDeviationScoreValues(
  targetsAnalysis: ServerDetailsExtended[],
  meanScoreValues: MeanScoreValues
): DeviationScoreValues {
  const accumulator = {
    hackLevel: 0,
    hackTime: 0,
    maxFunds: 0,
    growRate: 0,
    growTime: 0,
    weakenTime: 0,
    expGain: 0,
  };
  targetsAnalysis.forEach(value => {
    accumulator.hackLevel += Math.pow(
      value.hackLevel - meanScoreValues.hackLevel,
      2
    );
    accumulator.hackTime += Math.pow(
      value.hackTime - meanScoreValues.hackTime,
      2
    );
    accumulator.maxFunds += Math.pow(
      value.maxFunds - meanScoreValues.maxFunds,
      2
    );
    accumulator.growRate += Math.pow(
      value.growRate - meanScoreValues.growRate,
      2
    );
    accumulator.growTime += Math.pow(
      value.growTime - meanScoreValues.growTime,
      2
    );
    accumulator.weakenTime += Math.pow(
      value.weakenTime - meanScoreValues.weakenTime,
      2
    );
    accumulator.expGain += Math.pow(
      value.expGain ?? 0 - meanScoreValues.expGain,
      2
    );
  });
  const totalElements = targetsAnalysis.length;
  return {
    hackLevel: Math.sqrt(accumulator.hackLevel / totalElements),
    hackTime: Math.sqrt(accumulator.hackTime / totalElements),
    maxFunds: Math.sqrt(accumulator.maxFunds / totalElements),
    growRate: Math.sqrt(accumulator.growRate / totalElements),
    growTime: Math.sqrt(accumulator.growTime / totalElements),
    weakenTime: Math.sqrt(accumulator.weakenTime / totalElements),
    expGain: Math.sqrt(accumulator.expGain / totalElements),
  };
}

function getStandardValue(value: number, mean: number, deviation: number) {
  return (value - mean) / deviation;
}

function scoreHostForWGWH(
  targetDetails: ServerDetails,
  meanScoreValues: MeanScoreValues,
  deviationScoreValues: DeviationScoreValues,
  weightScoreValues: WeightScoreValues = {
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
    expGain: 1,
  }
) {
  targetDetails.score =
    weightScoreValues.hackTime *
      getStandardValue(
        targetDetails.hackTime,
        meanScoreValues.hackTime,
        deviationScoreValues.hackTime
      ) +
    weightScoreValues.maxFunds *
      getStandardValue(
        targetDetails.maxFunds,
        meanScoreValues.maxFunds,
        deviationScoreValues.maxFunds
      ) +
    weightScoreValues.growRate *
      getStandardValue(
        targetDetails.growRate,
        meanScoreValues.growRate,
        deviationScoreValues.growRate
      ) +
    weightScoreValues.growTime *
      getStandardValue(
        targetDetails.growTime,
        meanScoreValues.growTime,
        deviationScoreValues.growTime
      ) +
    weightScoreValues.weakenTime *
      getStandardValue(
        targetDetails.weakenTime,
        meanScoreValues.weakenTime,
        deviationScoreValues.weakenTime
      );
  return targetDetails.score;
}

function scoreHostForExperience(
  targetDetails: ServerDetailsExtended,
  meanScoreValues: MeanScoreValues,
  deviationScoreValues: DeviationScoreValues,
  weightScoreValues: WeightScoreValues = {
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
    expGain: 1,
  }
) {
  targetDetails.score =
    weightScoreValues.weakenTime *
      getStandardValue(
        targetDetails.weakenTime,
        meanScoreValues.weakenTime,
        deviationScoreValues.weakenTime
      ) +
    weightScoreValues.expGain *
      getStandardValue(
        targetDetails.expGain ?? 0,
        meanScoreValues.expGain,
        deviationScoreValues.expGain
      );
  return targetDetails.score;
}

function sortOptimalTargetHosts(
  targetsAnalysis: ServerDetails[],
  weightScoreValues: WeightScoreValues = {
    hackTime: 1,
    maxFunds: 1,
    growRate: 1,
    growTime: 1,
    weakenTime: 1,
    expGain: 1,
  },
  scoreFunc: ScoringFunction = scoreHostForWGWH
) {
  const meanScoreValues = getMeanScoreValues(targetsAnalysis);
  const deviationScoreValues = getDeviationScoreValues(
    targetsAnalysis,
    meanScoreValues
  );

  targetsAnalysis.sort(
    (hostDetails1, hostDetails2) =>
      scoreFunc(
        hostDetails1,
        meanScoreValues,
        deviationScoreValues,
        weightScoreValues
      ) -
      scoreFunc(
        hostDetails2,
        meanScoreValues,
        deviationScoreValues,
        weightScoreValues
      )
  );
}

function getHackingExpGain(netscript: NS, hostDetails: ServerDetails) {
  const extendedDetails = hostDetails as ServerDetailsExtended;
  extendedDetails.expGain = netscript.formulas.hacking.hackExp(
    netscript.getServer(hostDetails.hostname),
    netscript.getPlayer()
  );
  return extendedDetails;
}

export {
  ServerDetailsExtended,
  WeightScoreValues,
  scoreHostForWGWH,
  scoreHostForExperience,
  sortOptimalTargetHosts,
  getHackingExpGain,
};
