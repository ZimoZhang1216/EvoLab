import { ControlsPanel } from './components/ControlsPanel.jsx';
import { GenePanel } from './components/GenePanel.jsx';
import { GenerationPanel } from './components/GenerationPanel.jsx';
import { MechanismPanel } from './components/MechanismPanel.jsx';
import { SimulationCanvas } from './components/SimulationCanvas.jsx';
import { StatsPanel } from './components/StatsPanel.jsx';
import { SteadyStatePanel } from './components/SteadyStatePanel.jsx';
import { useEvolutionSimulation } from './hooks/useEvolutionSimulation.js';

export default function App() {
  const {
    canvasRef,
    isRunning,
    isMutationStormActive,
    settings,
    stats,
    geneStats,
    lineageStats,
    geneHistory,
    steadyHistory,
    environmentState,
    displayMode,
    experimentEvents,
    start,
    pause,
    reset,
    updateSetting,
    updateEnvironmentMode,
    updateDisplayMode,
  } = useEvolutionSimulation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">Evolution Lab</p>
          <div className="title-row">
            <h1>EvoLab：进化模拟器</h1>
            <span className="version-badge">V-3.10</span>
          </div>
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
        <section className="main-column" aria-label="模拟与基因监测">
          <section className="simulation-panel" aria-label="模拟世界">
            <SimulationCanvas canvasRef={canvasRef} />
          </section>

          <div className="monitor-row">
            <SteadyStatePanel stats={stats} history={steadyHistory} />
            <GenerationPanel lineageStats={lineageStats} />
            <GenePanel geneStats={geneStats} geneHistory={geneHistory} />
          </div>
        </section>

        <aside className="utility-column" aria-label="状态、控制与说明">
          <section className="operation-panel" aria-label="状态与控制">
            <StatsPanel stats={stats} />
            <ControlsPanel
              isRunning={isRunning}
              settings={settings}
              onStart={start}
              onPause={pause}
              onReset={reset}
              onSettingChange={updateSetting}
              onEnvironmentModeChange={updateEnvironmentMode}
              displayMode={displayMode}
              onDisplayModeChange={updateDisplayMode}
              experimentEvents={experimentEvents}
              isMutationStormActive={isMutationStormActive}
              environmentState={environmentState}
            />
          </section>

          <MechanismPanel />
        </aside>
      </main>
    </div>
  );
}
