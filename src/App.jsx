import { ControlsPanel } from './components/ControlsPanel.jsx';
import { SimulationCanvas } from './components/SimulationCanvas.jsx';
import { StatsPanel } from './components/StatsPanel.jsx';
import { useEvolutionSimulation } from './hooks/useEvolutionSimulation.js';

export default function App() {
  const {
    canvasRef,
    isRunning,
    isMutationStormActive,
    settings,
    stats,
    experimentEvents,
    start,
    pause,
    reset,
    updateSetting,
  } = useEvolutionSimulation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">Evolution Lab</p>
          <h1>EvoLab：进化模拟器</h1>
          <p className="intro">
            观察生物在食物、能量、繁殖和突变压力下的群体演化。
          </p>
        </div>
        <div className={isRunning ? 'run-state active' : 'run-state'}>
          <span className="status-dot" />
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
            experimentEvents={experimentEvents}
            isMutationStormActive={isMutationStormActive}
          />
        </aside>
      </main>
    </div>
  );
}
