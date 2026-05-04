import { getLineageColor } from '../simulation/lineageColors.js';

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function formatPercent(value) {
  return `${(value * 100).toFixed(0)}%`;
}

function compactGenerations(distribution, maxBars = 8) {
  if (distribution.length <= maxBars) {
    return distribution.map((item) => ({
      ...item,
      label: `G${item.generation}`,
    }));
  }

  const visibleCount = maxBars - 1;
  const visible = distribution.slice(-visibleCount);
  const older = distribution.slice(0, -visibleCount);
  const olderCount = older.reduce((sum, item) => sum + item.count, 0);
  const olderPercent = older.reduce((sum, item) => sum + item.percent, 0);

  return [
    {
      label: `<=G${visible[0].generation - 1}`,
      count: olderCount,
      percent: olderPercent,
    },
    ...visible.map((item) => ({
      ...item,
      label: `G${item.generation}`,
    })),
  ];
}

function buildLineageSegments(lineageDistribution) {
  const topSegments = lineageDistribution.slice(0, 5).map((item) => ({
    ...item,
    label: `L${item.id}`,
    color: getLineageColor(item.id),
  }));
  const other = lineageDistribution.slice(5);
  const otherCount = other.reduce((sum, item) => sum + item.count, 0);
  const otherPercent = other.reduce((sum, item) => sum + item.percent, 0);

  if (otherCount === 0) {
    return topSegments;
  }

  return topSegments.concat({
    id: 'other',
    label: '其他',
    count: otherCount,
    percent: otherPercent,
    color: '#6b7f8f',
  });
}

export function GenerationPanel({ lineageStats }) {
  if (lineageStats.population === 0) {
    return (
      <section className="panel-block generation-panel" aria-label="世代更迭">
        <h2>世代更迭</h2>
        <div className="empty-state">种群已灭绝</div>
      </section>
    );
  }

  const generationBars = compactGenerations(lineageStats.generationDistribution);
  const maxGenerationCount = Math.max(
    ...generationBars.map((item) => item.count),
    1,
  );
  const lineageSegments = buildLineageSegments(lineageStats.lineageDistribution);
  const dominantLineageId = lineageStats.topLineages[0]?.id;

  return (
    <section className="panel-block generation-panel" aria-label="世代更迭">
      <div className="generation-header">
        <h2>世代更迭</h2>
        <span>近 120 tick</span>
      </div>

      <div className="generation-metrics">
        <div>
          <span>最高世代</span>
          <strong>G{lineageStats.highestGeneration}</strong>
        </div>
        <div>
          <span>平均世代</span>
          <strong>{formatNumber(lineageStats.averageGeneration)}</strong>
        </div>
        <div>
          <span>主流世代</span>
          <strong>G{lineageStats.dominantGeneration}</strong>
        </div>
        <div>
          <span>出生 / 死亡</span>
          <strong>
            {lineageStats.recentBirths}/{lineageStats.recentDeaths}
          </strong>
        </div>
        <div>
          <span>存活谱系</span>
          <strong>{lineageStats.liveLineageCount}</strong>
        </div>
      </div>

      <div className="generation-section">
        <h3>世代分布</h3>
        <div className="generation-bars">
          {generationBars.map((item) => (
            <div className="distribution-row" key={item.label}>
              <span>{item.label}</span>
              <div className="distribution-track">
                <div
                  className="distribution-fill generation-fill"
                  style={{ width: `${(item.count / maxGenerationCount) * 100}%` }}
                />
              </div>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="generation-section">
        <h3>谱系占比</h3>
        <div className="lineage-stack" aria-label="谱系占比图">
          {lineageSegments.map((segment) => (
            <span
              key={segment.id}
              style={{
                width: `${Math.max(segment.percent * 100, 2)}%`,
                backgroundColor: segment.color,
              }}
              title={`${segment.label} ${formatPercent(segment.percent)}`}
            />
          ))}
        </div>

        <div className="lineage-list">
          {lineageStats.topLineages.map((lineage) => {
            const color = getLineageColor(lineage.id);
            const isDominant = lineage.id === dominantLineageId;

            return (
              <div
                className={isDominant ? 'lineage-row dominant' : 'lineage-row'}
                key={lineage.id}
              >
                <span
                  className="lineage-swatch"
                  style={{ backgroundColor: color, color }}
                />
                <span>L{lineage.id}</span>
                {isDominant && <em>最优</em>}
                <strong>
                  {lineage.count} · {formatPercent(lineage.percent)}
                </strong>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
