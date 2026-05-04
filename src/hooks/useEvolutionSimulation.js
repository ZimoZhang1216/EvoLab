import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, TRAIT_LIMITS } from '../simulation/constants.js';
import {
  applyEnvironmentalShock,
  calculateStats,
  createWorld,
  dropFoodBatch,
  removeHalfFood,
  stepWorld,
} from '../simulation/world.js';
import { drawWorld } from '../simulation/renderWorld.js';

const MUTATION_STORM_DURATION_MS = 12000;
const MUTATION_STORM_MULTIPLIER = 3;
const MUTATION_STORM_MIN_RATE = 0.18;

function createMutationStormSettings(settings) {
  const maxMutationRate = TRAIT_LIMITS.mutationRate[1];

  return {
    ...settings,
    mutationRate: Math.min(
      maxMutationRate,
      Math.max(settings.mutationRate * MUTATION_STORM_MULTIPLIER, MUTATION_STORM_MIN_RATE),
    ),
  };
}

export function useEvolutionSimulation() {
  const canvasRef = useRef(null);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const worldRef = useRef(createWorld(DEFAULT_SETTINGS));
  const mutationStormActiveRef = useRef(false);
  const mutationStormTimeoutRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState(calculateStats(worldRef.current));
  const [isRunning, setIsRunning] = useState(false);
  const [isMutationStormActive, setIsMutationStormActive] = useState(false);

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
        const activeSettings = mutationStormActiveRef.current
          ? createMutationStormSettings(settingsRef.current)
          : settingsRef.current;
        const scaledDelta = rawDelta * activeSettings.simulationSpeed;
        stepWorld(worldRef.current, activeSettings, scaledDelta);
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

  useEffect(() => {
    return () => {
      if (mutationStormTimeoutRef.current) {
        window.clearTimeout(mutationStormTimeoutRef.current);
      }
    };
  }, []);

  const refreshWorld = useCallback(() => {
    const world = worldRef.current;
    setStats(calculateStats(world));

    if (canvasRef.current) {
      drawWorld(canvasRef.current, world);
    }
  }, []);

  const stopMutationStorm = useCallback(() => {
    if (mutationStormTimeoutRef.current) {
      window.clearTimeout(mutationStormTimeoutRef.current);
      mutationStormTimeoutRef.current = null;
    }

    mutationStormActiveRef.current = false;
    setIsMutationStormActive(false);
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    stopMutationStorm();
    const nextWorld = createWorld(settingsRef.current);
    worldRef.current = nextWorld;
    setStats(calculateStats(nextWorld));
    setIsRunning(false);

    if (canvasRef.current) {
      drawWorld(canvasRef.current, nextWorld);
    }
  }, [stopMutationStorm]);

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

  const dropFood = useCallback(() => {
    dropFoodBatch(worldRef.current);
    refreshWorld();
  }, [refreshWorld]);

  const triggerFamine = useCallback(() => {
    removeHalfFood(worldRef.current);
    refreshWorld();
  }, [refreshWorld]);

  const triggerEnvironmentalShock = useCallback(() => {
    applyEnvironmentalShock(worldRef.current);
    refreshWorld();
  }, [refreshWorld]);

  const triggerMutationStorm = useCallback(() => {
    if (mutationStormTimeoutRef.current) {
      window.clearTimeout(mutationStormTimeoutRef.current);
    }

    mutationStormActiveRef.current = true;
    setIsMutationStormActive(true);
    refreshWorld();

    mutationStormTimeoutRef.current = window.setTimeout(() => {
      mutationStormActiveRef.current = false;
      mutationStormTimeoutRef.current = null;
      setIsMutationStormActive(false);
      refreshWorld();
    }, MUTATION_STORM_DURATION_MS);
  }, [refreshWorld]);

  return {
    canvasRef,
    isRunning,
    isMutationStormActive,
    settings,
    stats,
    experimentEvents: {
      dropFood,
      triggerFamine,
      triggerEnvironmentalShock,
      triggerMutationStorm,
    },
    start,
    pause,
    reset,
    updateSetting,
  };
}
