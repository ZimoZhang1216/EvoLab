export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 650;

export const INITIAL_CREATURE_COUNT = 30;
export const INITIAL_FOOD_COUNT = 95;
export const MAX_CREATURE_COUNT = 450;
export const MAX_FOOD_COUNT = 260;

export const CREATURE_RADIUS = 4;
export const FOOD_RADIUS = 2.6;
export const FOOD_ENERGY = 34;
export const ENERGY_COST_PER_DISTANCE = 0.028;
export const BASE_ENERGY_COST_PER_SECOND = 0.22;
export const WANDER_TURN_RATE = 2.6;

export const DEFAULT_SETTINGS = {
  simulationSpeed: 1,
  foodSpawnRate: 3,
  mutationRate: 0.08,
};

export const TRAIT_LIMITS = {
  speed: [18, 88],
  vision: [35, 220],
  reproductionThreshold: [95, 230],
  lifespan: [45, 210],
  mutationRate: [0, 0.3],
};

export const DEFAULT_TRAITS = {
  energy: 86,
  age: 0,
  speed: 43,
  vision: 105,
  reproductionThreshold: 145,
  lifespan: 120,
  mutationRate: DEFAULT_SETTINGS.mutationRate,
};
