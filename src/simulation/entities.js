import {
  CREATURE_RADIUS,
  DEFAULT_TRAITS,
  TRAIT_LIMITS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.js';
import { clamp, mutateTrait, randomHeading, randomRange } from './random.js';

export function createFood(id, position = {}) {
  return {
    id,
    x: position.x ?? randomRange(12, WORLD_WIDTH - 12),
    y: position.y ?? randomRange(12, WORLD_HEIGHT - 12),
  };
}

export function createCreature(id, settings, overrides = {}) {
  return {
    id,
    x: randomRange(40, WORLD_WIDTH - 40),
    y: randomRange(40, WORLD_HEIGHT - 40),
    heading: randomHeading(),
    generation: 0,
    lineageId: id,
    parentId: null,
    birthTick: 0,
    ...DEFAULT_TRAITS,
    mutationRate: settings.mutationRate,
    ...overrides,
  };
}

export function reproduceCreature(parent, id, settings, birthTick = 0) {
  const mutationRate = settings.mutationRate;
  const offset = randomRange(CREATURE_RADIUS * 3, CREATURE_RADIUS * 8);
  const heading = randomHeading();

  return createCreature(id, settings, {
    x: clamp(
      parent.x + Math.cos(heading) * offset,
      CREATURE_RADIUS,
      WORLD_WIDTH - CREATURE_RADIUS,
    ),
    y: clamp(
      parent.y + Math.sin(heading) * offset,
      CREATURE_RADIUS,
      WORLD_HEIGHT - CREATURE_RADIUS,
    ),
    heading,
    energy: parent.energy * 0.45,
    generation: (parent.generation ?? 0) + 1,
    lineageId: parent.lineageId ?? parent.id,
    parentId: parent.id,
    birthTick,
    speed: mutateTrait(parent.speed, mutationRate, TRAIT_LIMITS.speed),
    vision: mutateTrait(parent.vision, mutationRate, TRAIT_LIMITS.vision),
    reproductionThreshold: mutateTrait(
      parent.reproductionThreshold,
      mutationRate,
      TRAIT_LIMITS.reproductionThreshold,
    ),
    lifespan: mutateTrait(parent.lifespan, mutationRate, TRAIT_LIMITS.lifespan),
    mutationRate: mutateTrait(
      parent.mutationRate,
      mutationRate,
      TRAIT_LIMITS.mutationRate,
    ),
  });
}
