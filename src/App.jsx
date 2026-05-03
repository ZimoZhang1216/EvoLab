import { ControlsPanel } from './components/ControlsPanel.jsx';
import { SimulationCanvas } from './components/SimulationCanvas.jsx';
import { StatsPanel } from './components/StatsPanel.jsx';
import { useEvolutionSimulation } from './hooks/useEvolutionSimulation.js';

export default function App() {
  const {
    canvasRef,
    isRunning,
    settings,
    stats,
    start,
    pause,
    reset,
    updateSetting,
  } = useEvolutionSimulation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Browser Evolution Simulator</p>
          <h1>EvoLab</h1>
        </div>
        <div className={isRunning ? 'run-state active' : 'run-state'}>
          {isRunning ? '运行中' : '已暂停'}
        </div>
      </header>

      <main className="workspace">
        <section className="simulation-panel" aria-label="模拟世界">
          <SimulationCanvas canvasRef={canvasRef} />
        </section>

        <aside className="side-panel">
          <StatsPanel stats={stats} />
          <ControlsPanel
            isRunning={isRunning}
            settings={settings}
            onStart={start}
            onPause={pause}
            onReset={reset}
            onSettingChange={updateSetting}
          />
        </aside>
      </main>
    </div>
  );
}
