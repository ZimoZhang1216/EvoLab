const mechanismItems = [
  '绿色点代表食物。',
  '蓝色点代表生物。',
  '生物会寻找视野范围内最近的食物。',
  '如果找不到食物，生物会随机游走。',
  '移动会消耗能量。',
  '吃到食物会恢复能量。',
  '能量足够高时，生物会繁殖。',
  '子代会继承亲代参数，并发生小幅突变。',
  '能量耗尽或年龄过大时，生物死亡。',
];

const parameterItems = [
  ['energy', '能量，决定生物是否能继续存活。'],
  ['speed', '速度，影响移动快慢。'],
  ['vision', '视野，影响能发现多远的食物。'],
  ['reproductionThreshold', '繁殖阈值，能量超过该值后可以繁殖。'],
  ['lifespan', '寿命，年龄超过该值后死亡。'],
  ['mutationRate', '突变率，影响子代参数变化幅度。'],
];

const observationItems = [
  '调高食物生成率可以观察种群扩张。',
  '降低食物生成率可以制造竞争压力。',
  '调高突变率可以观察性状快速变化。',
  '长时间运行后，关注平均速度、平均视野、平均能量的变化。',
];

export function MechanismPanel() {
  return (
    <section className="panel-block mechanism-panel" aria-label="运行机制">
      <h2>运行机制</h2>

      <div className="mechanism-section">
        <h3>当前逻辑</h3>
        <ul className="mechanism-list">
          {mechanismItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mechanism-section">
        <h3>参数解释</h3>
        <dl className="parameter-list">
          {parameterItems.map(([term, description]) => (
            <div className="parameter-row" key={term}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mechanism-section">
        <h3>如何观察</h3>
        <ul className="mechanism-list">
          {observationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
