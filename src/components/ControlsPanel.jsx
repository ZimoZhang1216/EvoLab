import { ENVIRONMENT_MODES } from '../simulation/environmentModes.js';

const sliderMeta = {
  simulationSpeed: {
    label: '模拟速度',
    min: 0.05,
    max: 10,
    step: 0.05,
    suffix: 'x',
  },
  foodSpawnRate: {
    label: '食物生成率',
    min: 0,
    max: 50,
    step: 0.1,
    suffix: '/s',
  },
  mutationRate: {
    label: '突变率',
    min: 0,
    max: 0.5,
    step: 0.005,
    suffix: '',
  },
};

function formatControlValue(key, value) {
  if (key === 'simulationSpeed') {
    return `${value.toFixed(2)}${sliderMeta[key].suffix}`;
  }

  if (key === 'foodSpawnRate') {
    return `${value.toFixed(1)}${sliderMeta[key].suffix}`;
  }

  if (key === 'mutationRate') {
    return `${(value * 100).toFixed(1)}%`;
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
  onEnvironmentModeChange,
  experimentEvents,
  isMutationStormActive,
  environmentState,
}) {
  const environmentModes = Object.values(ENVIRONMENT_MODES);

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

      <div className="environment-section">
        <div className="section-heading">
          <h3>环境模式</h3>
          <span className="environment-current">
            {environmentState.label}
            {environmentState.seasonLabel ? ` · ${environmentState.seasonLabel}` : ''}
          </span>
        </div>

        <div className="environment-grid">
          {environmentModes.map((mode) => (
            <button
              type="button"
              className={
                environmentState.id === mode.id
                  ? 'environment-option active'
                  : 'environment-option'
              }
              key={mode.id}
              onClick={() => onEnvironmentModeChange(mode.id)}
            >
              <span>{mode.label}</span>
              <small>{mode.description}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="event-section">
        <div className="section-heading">
          <h3>实验事件</h3>
          {isMutationStormActive && (
            <span className="event-badge">突变风暴中</span>
          )}
        </div>

        <div className="event-grid">
          <button type="button" onClick={experimentEvents.dropFood}>
            投放食物
          </button>
          <button
            type="button"
            className="secondary"
            onClick={experimentEvents.triggerFamine}
          >
            饥荒
          </button>
          <button
            type="button"
            className="secondary"
            onClick={experimentEvents.triggerEnvironmentalShock}
          >
            环境冲击
          </button>
          <button
            type="button"
            className="storm-button"
            onClick={experimentEvents.triggerMutationStorm}
            disabled={isMutationStormActive}
          >
            突变风暴
          </button>
        </div>
      </div>
    </section>
  );
}
