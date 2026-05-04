export const METRIC_CONFIG = {
  h2_cost: {
    label: "H₂ Production Cost",
    unit: "$M/yr",
    direction: "minimize",
    scaleRaw: v => v / 1e6,
    fmtVal: v => `$${v.toFixed(2)}M`,
    placeholder: "e.g. 130",
    hint: "In $M/yr — e.g. 130 = $130 million/year",
  },
  co2_annual_tonnes: {
    label: "CO₂ Emissions",
    unit: "kt/yr",
    direction: "minimize",
    scaleRaw: v => v / 1000,
    fmtVal: v => `${v.toFixed(1)}kt`,
    placeholder: "e.g. 850",
    hint: "In kilotonnes/yr — e.g. 850 = 850,000 t/yr",
  },
  smr_conversion: {
    label: "SMR Conversion",
    unit: "%",
    direction: "maximize",
    scaleRaw: v => v * 100,
    fmtVal: v => `${v.toFixed(2)}%`,
    placeholder: "e.g. 85",
    hint: "In percent — e.g. 85 = 85% conversion",
  },
  h2_production: {
    label: "H₂ Production Rate",
    unit: "kmol/h",
    direction: "maximize",
    scaleRaw: v => v,
    fmtVal: v => `${v.toFixed(0)} kmol/h`,
    placeholder: "e.g. 1200",
    hint: "In kmol/h",
  },
};

export function getOptVal(scenario, metricKey) {
  const cfg = METRIC_CONFIG[metricKey];
  if (!cfg) return null;
  const raw = scenario.optimized_results?.[metricKey] ?? scenario.results?.[metricKey];
  return raw != null ? cfg.scaleRaw(raw) : null;
}

export function getCurVal(scenario, metricKey) {
  const cfg = METRIC_CONFIG[metricKey];
  if (!cfg) return null;
  const raw = scenario.results?.[metricKey];
  return raw != null ? cfg.scaleRaw(raw) : null;
}

export function computeProgress(target, history) {
  const cfg = METRIC_CONFIG[target.metric];
  if (!cfg) {
    return { currentBest: null, progress: 0, remaining: 0, bestScenario: null, achieved: false };
  }

  const pairs = history
    .map(s => ({ s, val: getOptVal(s, target.metric) }))
    .filter(({ val }) => val != null);

  if (!pairs.length) {
    return { currentBest: null, progress: 0, remaining: 0, bestScenario: null, achieved: false };
  }

  const sorted = [...pairs].sort((a, b) =>
    cfg.direction === "minimize" ? a.val - b.val : b.val - a.val
  );

  const { val: currentBest, s: bestScenario } = sorted[0];
  const baseline = target.baseline;
  const goal = target.targetValue;

  let progress = 0;
  if (cfg.direction === "minimize" && baseline > goal) {
    progress = Math.max(0, Math.min(100, ((baseline - currentBest) / (baseline - goal)) * 100));
  } else if (cfg.direction === "maximize" && goal > baseline) {
    progress = Math.max(0, Math.min(100, ((currentBest - baseline) / (goal - baseline)) * 100));
  }

  const remaining = cfg.direction === "minimize"
    ? Math.max(0, currentBest - goal)
    : Math.max(0, goal - currentBest);

  const achieved = cfg.direction === "minimize"
    ? currentBest <= goal
    : currentBest >= goal;

  return {
    currentBest,
    progress: Math.round(progress * 10) / 10,
    remaining,
    bestScenario,
    achieved,
  };
}
