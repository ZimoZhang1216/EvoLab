import { getLineageColor } from '../simulation/lineageColors.js';

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function formatPercent(value) {
  return `${(value * 100).toFixed(0)}%`;
}

function formatMutationRate(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '0.000';
}

function getAverage(lineage, key) {
  return lineage.averages[key] ?? 0;
}

function buildAdvantageExplanation(lineage, overall) {
  const recent = lineage.recent;
  const averages = lineage.averages;

  if (lineage.percent >= 0.12 && recent.netGrowth < 0) {
    return '该谱系属于历史优势谱系，但近期净增长为负，可能正在失去优势。';
  }

  if (recent.netGrowth >= 4) {
    return '该谱系近期净增长明显，当前适应度较高，正在扩张。';
  }

  if (recent.foodEaten >= Math.max(3, recent.deaths + 2)) {
    return '该谱系近期食物获取较多，可能具备较高觅食效率。';
  }

  if (recent.births >= Math.max(3, recent.deaths + 2)) {
    return '该谱系近期出生贡献较高，繁殖扩张较明显。';
  }

  if (recent.deaths === 0 && lineage.count >= 3) {
    return '该谱系近期死亡较少，表现出较好的生存稳定性。';
  }

  if (averages.vision > overall.vision * 1.08) {
    return '该谱系可能依靠较高视野发现更多食物。';
  }

  if (averages.speed > overall.speed * 1.08) {
    return '该谱系移动能力较强，可能更容易抢到食物，但也有能耗代价。';
  }

  if (averages.reproductionThreshold < overall.reproductionThreshold * 0.95) {
    return '该谱系繁殖阈值较低，因此更容易进入繁殖。';
  }

  if (averages.energy > overall.energy * 1.08) {
    return '该谱系平均能量更高，当前能量状态较好。';
  }

  return '该谱系当前占比较高，但优势来源不集中，可能来自多项性状的综合平衡。';
}

export function LineageAdvantagePanel({ advantageStats }) {
  if (advantageStats.population === 0) {
    return (
      <section className="panel-block lineage-advantage-panel" aria-label="谱系优势分析">
        <h2>谱系优势分析</h2>
        <div className="empty-state">种群已灭绝，无法分析谱系优势。</div>
      </section>
    );
  }

  return (
    <section className="panel-block lineage-advantage-panel" aria-label="谱系优势分析">
      <div className="lineage-advantage-header">
        <h2>谱系优势分析</h2>
        <span>近 {advantageStats.windowSize}/300 tick</span>
      </div>

      <div className="lineage-advantage-list">
        {advantageStats.lineages.map((lineage, index) => {
          const color = getLineageColor(lineage.id);
          const explanation = buildAdvantageExplanation(
            lineage,
            advantageStats.overall,
          );

          return (
            <article
              className={index === 0 ? 'advantage-card dominant' : 'advantage-card'}
              key={lineage.id}
            >
              <div className="advantage-title">
                <span className="lineage-swatch" style={{ backgroundColor: color, color }} />
                <strong>L{lineage.id}</strong>
                {index === 0 && <em>当前优势谱系</em>}
              </div>

              <div className="advantage-counts">
                <span>
                  占比 <strong>{formatPercent(lineage.percent)}</strong>
                </span>
                <span>
                  数量 <strong>{lineage.count}</strong>
                </span>
                <span>
                  净增长 <strong>{lineage.recent.netGrowth}</strong>
                </span>
              </div>

              <div className="advantage-traits">
                <span>
                  speed <strong>{formatNumber(getAverage(lineage, 'speed'))}</strong>
                </span>
                <span>
                  vision <strong>{formatNumber(getAverage(lineage, 'vision'))}</strong>
                </span>
                <span>
                  reproductionThreshold{' '}
                  <strong>
                    {formatNumber(getAverage(lineage, 'reproductionThreshold'))}
                  </strong>
                </span>
                <span>
                  lifespan <strong>{formatNumber(getAverage(lineage, 'lifespan'))}</strong>
                </span>
                <span>
                  mutationRate{' '}
                  <strong>{formatMutationRate(getAverage(lineage, 'mutationRate'))}</strong>
                </span>
                <span>
                  energy <strong>{formatNumber(getAverage(lineage, 'energy'))}</strong>
                </span>
                <span>
                  age <strong>{formatNumber(getAverage(lineage, 'age'))}</strong>
                </span>
              </div>

              <div className="advantage-recent">
                <span>
                  出生 <strong>{lineage.recent.births}</strong>
                </span>
                <span>
                  死亡 <strong>{lineage.recent.deaths}</strong>
                </span>
                <span>
                  食物获取 <strong>{lineage.recent.foodEaten}</strong>
                </span>
                <span>
                  繁殖 <strong>{lineage.recent.reproductions}</strong>
                </span>
              </div>

              <p>{explanation}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
