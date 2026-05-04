import { WORLD_HEIGHT, WORLD_WIDTH } from './constants.js';
import { clamp, randomRange } from './random.js';

export const DEFAULT_ENVIRONMENT_MODE = 'normal';

export const ENVIRONMENT_MODES = {
  normal: {
    id: 'normal',
    label: '普通环境',
    description: '食物按当前生成率均匀随机出现。',
    spawnMultiplier: 1,
  },
  scarce: {
    id: 'scarce',
    label: '食物稀缺',
    description: '降低食物生成率，强化竞争压力。',
    spawnMultiplier: 0.45,
  },
  rich: {
    id: 'rich',
    label: '食物富集',
    description: '提高食物生成率，观察资源充足时的扩张。',
    spawnMultiplier: 1.85,
  },
  patchy: {
    id: 'patchy',
    label: '斑块环境',
    description: '食物更常出现在热点附近，速度和视野更关键。',
    spawnMultiplier: 1,
  },
  seasonal: {
    id: 'seasonal',
    label: '季节波动',
    description: '食物生成率在丰饶期和饥荒期之间周期变化。',
    spawnMultiplier: 1,
  },
};

const SEASON_DURATION_SECONDS = 32;
const ABUNDANT_SEASON_SECONDS = 18;
const SEASONAL_ABUNDANT_MULTIPLIER = 1.85;
const SEASONAL_FAMINE_MULTIPLIER = 0.3;

const FOOD_PATCHES = [
  { x: WORLD_WIDTH * 0.24, y: WORLD_HEIGHT * 0.28 },
  { x: WORLD_WIDTH * 0.68, y: WORLD_HEIGHT * 0.26 },
  { x: WORLD_WIDTH * 0.52, y: WORLD_HEIGHT * 0.72 },
];

export function getEnvironmentMode(modeId) {
  return ENVIRONMENT_MODES[modeId] ?? ENVIRONMENT_MODES[DEFAULT_ENVIRONMENT_MODE];
}

export function getEnvironmentState(modeId = DEFAULT_ENVIRONMENT_MODE, elapsedTime = 0) {
  const mode = getEnvironmentMode(modeId);

  if (mode.id !== 'seasonal') {
    return {
      ...mode,
      seasonLabel: null,
      spawnMultiplier: mode.spawnMultiplier,
    };
  }

  const seasonTime = elapsedTime % SEASON_DURATION_SECONDS;
  const isAbundant = seasonTime < ABUNDANT_SEASON_SECONDS;

  return {
    ...mode,
    seasonLabel: isAbundant ? '丰饶期' : '饥荒期',
    spawnMultiplier: isAbundant
      ? SEASONAL_ABUNDANT_MULTIPLIER
      : SEASONAL_FAMINE_MULTIPLIER,
  };
}

export function createFoodPosition(environmentState) {
  if (environmentState.id === 'patchy' && Math.random() < 0.88) {
    const patch = FOOD_PATCHES[Math.floor(Math.random() * FOOD_PATCHES.length)];
    const angle = randomRange(0, Math.PI * 2);
    const distance = Math.sqrt(Math.random()) * randomRange(20, 120);

    return {
      x: clamp(patch.x + Math.cos(angle) * distance, 12, WORLD_WIDTH - 12),
      y: clamp(patch.y + Math.sin(angle) * distance, 12, WORLD_HEIGHT - 12),
    };
  }

  return {
    x: randomRange(12, WORLD_WIDTH - 12),
    y: randomRange(12, WORLD_HEIGHT - 12),
  };
}
