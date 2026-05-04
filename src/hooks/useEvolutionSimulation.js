import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, TRAIT_LIMITS } from '../simulation/constants.js';
import {
  applyEnvironmentalShock,
  calculateGeneStats,
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
const GENE_SAMPLE_INTERVAL_MS = 1000;
const MAX_GENE_HISTORY_POINTS = 300;
const MAX_STEADY_HISTORY_POINTS = 300;

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
  const geneSampleIndexRef = useRef(0);
  const steadySampleIndexRef = useRef(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState(calculateStats(worldRef.current));
  const [geneStats, setGeneStats] = useState(calculateGeneStats(worldRef.current));
  const [geneHistory, setGeneHistory] = useState([]);
  const [steadyHistory, setSteadyHistory] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isMutationStormActive, setIsMutationStormActive] = useState(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const sampleMonitoring = useCallback(() => {
    const nextStats = calculateStats(worldRef.current);
    const nextGeneStats = calculateGeneStats(worldRef.current);
    setStats(nextStats);
    setGeneStats(nextGeneStats);

    const nextSteadySample = {
      id: steadySampleIndexRef.current,
      population: nextStats.population,
      foodCount: nextStats.foodCount,
      averageSpeed: nextStats.averageSpeed,
      averageVision: nextStats.averageVision,
      averageEnergy: nextStats.averageEnergy,
    };
    steadySampleIndexRef.current += 1;

    setSteadyHistory((current) => {
      const next = current.concat(nextSteadySample);

      if (next.length > MAX_STEADY_HISTORY_POINTS) {
        return next.slice(next.length - MAX_STEADY_HISTORY_POINTS);
      }

      return next;
    });

    if (nextGeneStats.population > 0) {
      const nextGeneSample = {
        id: geneSampleIndexRef.current,
        values: Object.fromEntries(
          Object.entries(nextGeneStats.genes).map(([key, gene]) => [
            key,
            gene.average,
          ]),
        ),
      };
      geneSampleIndexRef.current += 1;

      setGeneHistory((current) => {
        const next = current.concat(nextGeneSample);

        if (next.length > MAX_GENE_HISTORY_POINTS) {
          return next.slice(next.length - MAX_GENE_HISTORY_POINTS);
        }

        return next;
      });
    }
  }, []);

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();
    let previousStatsTime = 0;
    let previousGeneSampleTime = performance.now();

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

      if (isRunning && time - previousGeneSampleTime > GENE_SAMPLE_INTERVAL_MS) {
        sampleMonitoring();
        previousGeneSampleTime = time;
      }

      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isRunning, sampleMonitoring]);

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
    setGeneStats(calculateGeneStats(world));

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
    geneSampleIndexRef.current = 0;
    steadySampleIndexRef.current = 0;
    setStats(calculateStats(nextWorld));
    setGeneStats(calculateGeneStats(nextWorld));
    setGeneHistory([]);
    setSteadyHistory([]);
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
    geneStats,
    geneHistory,
    steadyHistory,
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
