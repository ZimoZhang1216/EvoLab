const geneLabels = {
  speed: '速度 speed',
  vision: '视野 vision',
  reproductionThreshold: '繁殖阈值 reproductionThreshold',
  lifespan: '寿命 lifespan',
  mutationRate: '突变率 mutationRate',
};

const geneOrder = [
  'speed',
  'vision',
  'reproductionThreshold',
  'lifespan',
  'mutationRate',
];

const chartColors = {
  speed: '#69d7ff',
  vision: '#7cffb2',
  reproductionThreshold: '#ffd876',
  lifespan: '#b68cff',
  mutationRate: '#ff8fb1',
};

function formatGeneValue(key, value) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  if (key === 'mutationRate') {
    return value.toFixed(3);
  }

  return value.toFixed(1);
}

function buildTrendPoints(history, key, width, height) {
  const values = history
    .map((sample) => sample.values[key])
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return {
      values,
      points: '',
    };
  }

  if (values.length === 1) {
    const y = height / 2;

    return {
      values,
      points: `0,${y} ${width},${y}`,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return {
    values,
    points: values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - ((value - min) / range) * height;

        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' '),
  };
}

function GeneTrendChart({ history, geneKey }) {
  const width = 168;
  const height = 54;
  const { values, points } = buildTrendPoints(history, geneKey, width, height);

  return (
    <svg
      className="gene-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${geneLabels[geneKey]} 平均值趋势`}
      preserveAspectRatio="none"
    >
      <line className="gene-chart-grid" x1="0" y1="18" x2={width} y2="18" />
      <line className="gene-chart-grid" x1="0" y1="36" x2={width} y2="36" />
      {values.length > 0 ? (
        <polyline
          fill="none"
          points={points}
          stroke={chartColors[geneKey]}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
      ) : (
        <text className="gene-chart-empty" x="50%" y="52%" textAnchor="middle">
          等待采样
        </text>
      )}
    </svg>
  );
}

export function GenePanel({ geneStats, geneHistory }) {
  if (geneStats.population === 0) {
    return (
      <section className="panel-block gene-panel" aria-label="基因监测">
        <h2>基因监测</h2>
        <div className="empty-state">种群已灭绝</div>
      </section>
    );
  }

  return (
    <section className="panel-block gene-panel" aria-label="基因监测">
      <div className="gene-header">
        <h2>基因监测</h2>
        <span>{geneHistory.length}/300 采样点</span>
      </div>

      <div className="gene-grid">
        {geneOrder.map((geneKey) => {
          const gene = geneStats.genes[geneKey];

          return (
            <article className="gene-card" key={geneKey}>
              <div className="gene-card-header">
                <h3>{geneLabels[geneKey]}</h3>
                <strong>{formatGeneValue(geneKey, gene.average)}</strong>
              </div>

              <div className="gene-values">
                <span>
                  平均 average <strong>{formatGeneValue(geneKey, gene.average)}</strong>
                </span>
                <span>
                  最小 min <strong>{formatGeneValue(geneKey, gene.min)}</strong>
                </span>
                <span>
                  最大 max <strong>{formatGeneValue(geneKey, gene.max)}</strong>
                </span>
              </div>

              <GeneTrendChart history={geneHistory} geneKey={geneKey} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
