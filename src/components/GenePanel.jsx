const geneLabels = {
  speed: {
    name: '速度',
    code: 'speed',
  },
  vision: {
    name: '视野',
    code: 'vision',
  },
  reproductionThreshold: {
    name: '繁殖阈值',
    code: 'reproductionThreshold',
  },
  lifespan: {
    name: '寿命',
    code: 'lifespan',
  },
  mutationRate: {
    name: '突变率',
    code: 'mutationRate',
  },
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

function buildTrendPoints(history, key, width, height, padding) {
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
      points: `${padding.left},${y} ${width - padding.right},${y}`,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  return {
    values,
    points: values
      .map((value, index) => {
        const x = padding.left + (index / (values.length - 1)) * chartWidth;
        const y =
          padding.top + chartHeight - ((value - min) / range) * chartHeight;

        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' '),
  };
}

function GeneTrendChart({ history, geneKey }) {
  const width = 160;
  const height = 48;
  const padding = {
    top: 6,
    right: 12,
    bottom: 6,
    left: 10,
  };
  const clipId = `gene-chart-clip-${geneKey}`;
  const { values, points } = buildTrendPoints(
    history,
    geneKey,
    width,
    height,
    padding,
  );

  return (
    <div
      className="gene-chart-frame"
      role="img"
      aria-label={`${geneLabels[geneKey].name} ${geneLabels[geneKey].code} 平均值趋势`}
    >
      <svg
        className="gene-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={padding.left}
              y={padding.top}
              width={width - padding.left - padding.right}
              height={height - padding.top - padding.bottom}
            />
          </clipPath>
        </defs>
        <line
          className="gene-chart-grid"
          x1={padding.left}
          y1="18"
          x2={width - padding.right}
          y2="18"
        />
        <line
          className="gene-chart-grid"
          x1={padding.left}
          y1="36"
          x2={width - padding.right}
          y2="36"
        />
        <polyline
          className={values.length > 0 ? 'gene-chart-line' : 'gene-chart-line empty'}
          fill="none"
          points={points}
          stroke={chartColors[geneKey]}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
          clipPath={`url(#${clipId})`}
        />
      </svg>
      {values.length === 0 && <span className="gene-chart-empty">等待采样</span>}
    </div>
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
                <h3>
                  {geneLabels[geneKey].name}
                  <small>{geneLabels[geneKey].code}</small>
                </h3>
                <strong>{formatGeneValue(geneKey, gene.average)}</strong>
              </div>

              <div className="gene-values">
                <span>
                  平均 <strong>{formatGeneValue(geneKey, gene.average)}</strong>
                </span>
                <span>
                  最小 <strong>{formatGeneValue(geneKey, gene.min)}</strong>
                </span>
                <span>
                  最大 <strong>{formatGeneValue(geneKey, gene.max)}</strong>
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
