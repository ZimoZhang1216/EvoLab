const sliderMeta = {
  simulationSpeed: {
    label: '模拟速度',
    min: 0.25,
    max: 4,
    step: 0.25,
    suffix: 'x',
  },
  foodSpawnRate: {
    label: '食物生成率',
    min: 0,
    max: 12,
    step: 0.5,
    suffix: '/s',
  },
  mutationRate: {
    label: '突变率',
    min: 0,
    max: 0.3,
    step: 0.01,
    suffix: '',
  },
};

function formatControlValue(key, value) {
  if (key === 'mutationRate') {
    return `${Math.round(value * 100)}%`;
  }

  return `${value}${sliderMeta[key].suffix}`;
}

export function ControlsPanel({
  isRunning,
  settings,
  onStart,
  onPause,
  onReset,
  onSettingChange,
}) {
  return (
    <section className="panel-block" aria-label="模拟控制">
      <h2>控制面板</h2>
      <div className="button-row">
        <button type="button" onClick={onStart} disabled={isRunning}>
          开始
        </button>
        <button type="button" onClick={onPause} disabled={!isRunning}>
          暂停
        </button>
        <button type="button" className="secondary" onClick={onReset}>
          重置
        </button>
      </div>

      <div className="control-list">
        {Object.entries(sliderMeta).map(([key, meta]) => (
          <label className="range-control" key={key}>
            <span className="range-label">
              <span>{meta.label}</span>
              <strong>{formatControlValue(key, settings[key])}</strong>
            </span>
            <input
              type="range"
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={settings[key]}
              onChange={(event) => onSettingChange(key, event.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
