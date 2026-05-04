function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

export function StatsPanel({ stats }) {
  const items = [
    ['population', stats.population.toString()],
    ['average speed', formatNumber(stats.averageSpeed)],
    ['average vision', formatNumber(stats.averageVision)],
    ['average energy', formatNumber(stats.averageEnergy)],
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
