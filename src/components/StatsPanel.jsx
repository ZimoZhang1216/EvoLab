function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function formatSimulationTime(value) {
  const totalSeconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function StatsPanel({ stats }) {
  const items = [
    ['种群', stats.population.toString()],
    ['食物', stats.foodCount.toString()],
    ['时间', formatSimulationTime(stats.elapsedTime)],
    ['均速', formatNumber(stats.averageSpeed)],
    ['视野', formatNumber(stats.averageVision)],
    ['能量', formatNumber(stats.averageEnergy)],
  ];

  return (
    <section className="panel-block" aria-label="模拟统计">
      <h2>统计数据</h2>
      <div className="stats-grid">
        {items.map(([label, value]) => (
          <div className="stat-tile" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
