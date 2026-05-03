import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS } from '../simulation/constants.js';
import { calculateStats, createWorld, stepWorld } from '../simulation/world.js';
import { drawWorld } from '../simulation/renderWorld.js';

export function useEvolutionSimulation() {
  const canvasRef = useRef(null);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const worldRef = useRef(createWorld(DEFAULT_SETTINGS));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState(calculateStats(worldRef.current));
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();
    let previousStatsTime = 0;

    const frame = (time) => {
      const rawDelta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      if (isRunning) {
        const scaledDelta = rawDelta * settingsRef.current.simulationSpeed;
        stepWorld(worldRef.current, settingsRef.current, scaledDelta);
      }

      if (canvasRef.current) {
        drawWorld(canvasRef.current, worldRef.current);
      }

      if (time - previousStatsTime > 180) {
        setStats(calculateStats(worldRef.current));
        previousStatsTime = time;
      }

      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isRunning]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    const nextWorld = createWorld(settingsRef.current);
    worldRef.current = nextWorld;
    setStats(calculateStats(nextWorld));
    setIsRunning(false);

    if (canvasRef.current) {
      drawWorld(canvasRef.current, nextWorld);
    }
  }, []);

  const updateSetting = useCallback((key, rawValue) => {
    const value = Number(rawValue);

    setSettings((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      settingsRef.current = next;
      return next;
    });
  }, []);

  return {
    canvasRef,
    isRunning,
    settings,
    stats,
    start,
    pause,
    reset,
    updateSetting,
  };
}
