const metricConfigs = [
  {
    key: 'population',
  },
  {
    key: 'foodCount',
  },
  {
    key: 'averageSpeed',
  },
  {
    key: 'averageVision',
  },
  {
    key: 'averageEnergy',
  },
];

const STABILITY_WINDOW_SIZE = 20;
const MIN_STABLE_SAMPLE_COUNT = 12;
const TREND_LIMITS = {
  population: 0.42,
  foodCount: 1.2,
  averageSpeed: 0.12,
  averageVision: 0.12,
  averageEnergy: 0.34,
};
const VOLATILITY_LIMITS = {
  population: 0.5,
  foodCount: 1.4,
  averageSpeed: 0.12,
  averageVision: 0.12,
  averageEnergy: 0.48,
};

const statusLabels = {
  steady: '接近稳态',
  evolving: '仍在演化',
  volatile: '剧烈波动',
  endangered: '种群濒危',
  extinct: '种群已灭绝',
};

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));

  return Math.sqrt(variance);
}

function analyzeMetric(history, key) {
  const window = history.slice(-STABILITY_WINDOW_SIZE);
  const values = window
    .map((sample) => sample[key])
    .filter((value) => Number.isFinite(value));

  if (values.length < 2) {
    return {
      latest: values[values.length - 1] ?? 0,
      relativeChange: 0,
      volatility: 0,
      direction: 'flat',
    };
  }

  const segmentSize = Math.max(2, Math.floor(values.length / 4));
  const startAverage = average(values.slice(0, segmentSize));
  const endAverage = average(values.slice(-segmentSize));
  const baseline = Math.max(Math.abs(startAverage), 1);
  const relativeChange = (endAverage - startAverage) / baseline;
  const volatility = standardDeviation(values) / Math.max(Math.abs(average(values)), 1);

  let direction = 'flat';

  if (relativeChange > 0.04) {
    direction = 'up';
  } else if (relativeChange < -0.04) {
    direction = 'down';
  }

  return {
    latest: values[values.length - 1],
    relativeChange,
    volatility,
    direction,
  };
}

function getSystemStatus(stats, history, trendAnalyses) {
  if (stats.population === 0) {
    return 'extinct';
  }

  if (stats.population <= 6 || stats.averageEnergy <= 12) {
    return 'endangered';
  }

  if (history.length < MIN_STABLE_SAMPLE_COUNT) {
    return 'evolving';
  }

  const populationTrend = Math.abs(trendAnalyses.population.relativeChange);
  const energyTrend = Math.abs(trendAnalyses.averageEnergy.relativeChange);
  const populationVolatility = trendAnalyses.population.volatility;
  const energyVolatility = trendAnalyses.averageEnergy.volatility;

  if (
    populationTrend > 0.9 ||
    populationVolatility > 0.75 ||
    energyTrend > 0.85 ||
    energyVolatility > 0.68
  ) {
    return 'volatile';
  }

  const unstableMetrics = Object.entries(trendAnalyses).filter(
    ([key, analysis]) =>
      Math.abs(analysis.relativeChange) > TREND_LIMITS[key] ||
      analysis.volatility > VOLATILITY_LIMITS[key],
  );

  if (unstableMetrics.length >= 3) {
    return 'volatile';
  }

  if (unstableMetrics.length <= 1) {
    return 'steady';
  }

  return 'evolving';
}

export function SteadyStatePanel({ stats, history }) {
  const effectiveHistory =
    history.length > 0
      ? history
      : [
          {
            population: stats.population,
            foodCount: stats.foodCount,
            averageSpeed: stats.averageSpeed,
            averageVision: stats.averageVision,
            averageEnergy: stats.averageEnergy,
          },
        ];
  const trendAnalyses = Object.fromEntries(
    metricConfigs.map((metric) => [
      metric.key,
      analyzeMetric(effectiveHistory, metric.key),
    ]),
  );
  const status = getSystemStatus(stats, history, trendAnalyses);

  return (
    <section className="panel-block steady-panel" aria-label="稳态监测">
      <div className="steady-header">
        <h2>稳态监测</h2>
      </div>

      <div className={`steady-status steady-summary ${status}`}>
        <span>当前系统状态</span>
        <strong>{statusLabels[status]}</strong>
      </div>
    </section>
  );
}
