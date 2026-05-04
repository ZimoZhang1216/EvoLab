import {
  BASE_ENERGY_COST_PER_SECOND,
  CREATURE_RADIUS,
  ENERGY_COST_PER_DISTANCE,
  FOOD_ENERGY,
  INITIAL_CREATURE_COUNT,
  INITIAL_FOOD_COUNT,
  MAX_CREATURE_COUNT,
  MAX_FOOD_COUNT,
  SPEED_COST_REFERENCE,
  SPEED_COST_SCALE,
  VISION_COST_PER_POINT,
  VISION_COST_REFERENCE,
  WANDER_TURN_RATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.js';
import {
  createFoodPosition,
  getEnvironmentState,
} from './environmentModes.js';
import { createCreature, createFood, reproduceCreature } from './entities.js';
import { clamp, distanceSquared, randomRange } from './random.js';

export const GENE_KEYS = [
  'speed',
  'vision',
  'reproductionThreshold',
  'lifespan',
  'mutationRate',
];

const MAX_LIFECYCLE_HISTORY_POINTS = 300;
const LINEAGE_RECENT_WINDOW = 120;

export function createWorld(settings) {
  const world = {
    tick: 0,
    elapsedTime: 0,
    foodSpawnAccumulator: 0,
    nextCreatureId: 1,
    nextFoodId: 1,
    lifecycleHistory: [],
    creatures: [],
    foods: [],
  };

  for (let index = 0; index < INITIAL_CREATURE_COUNT; index += 1) {
    world.creatures.push(
      createCreature(world.nextCreatureId, settings, {
        generation: 0,
        lineageId: world.nextCreatureId,
        parentId: null,
        birthTick: world.tick,
      }),
    );
    world.nextCreatureId += 1;
  }

  for (let index = 0; index < INITIAL_FOOD_COUNT; index += 1) {
    addFood(world, getEnvironmentState(settings.environmentMode, world.elapsedTime));
  }

  return world;
}

export function stepWorld(world, settings, deltaSeconds) {
  world.tick += 1;
  world.elapsedTime += deltaSeconds;
  spawnFood(world, settings, deltaSeconds);

  const survivors = [];
  const births = [];
  let deaths = 0;

  for (const creature of world.creatures) {
    updateCreature(creature, world, deltaSeconds);

    if (creature.energy <= 0 || creature.age > creature.lifespan) {
      deaths += 1;
      continue;
    }

    if (
      creature.energy > creature.reproductionThreshold &&
      survivors.length + births.length < MAX_CREATURE_COUNT
    ) {
      const child = reproduceCreature(
        creature,
        world.nextCreatureId,
        settings,
        world.tick,
      );
      world.nextCreatureId += 1;
      creature.energy *= 0.55;
      births.push(child);
    }

    survivors.push(creature);
  }

  world.creatures = survivors.concat(births);
  recordLifecycle(world, births.length, deaths);
}

export function calculateStats(world) {
  const population = world.creatures.length;

  if (population === 0) {
    return {
      population,
      foodCount: world.foods.length,
      elapsedTime: world.elapsedTime,
      averageSpeed: 0,
      averageVision: 0,
      averageEnergy: 0,
    };
  }

  const totals = world.creatures.reduce(
    (sum, creature) => ({
      speed: sum.speed + creature.speed,
      vision: sum.vision + creature.vision,
      energy: sum.energy + creature.energy,
    }),
    { speed: 0, vision: 0, energy: 0 },
  );

  return {
    population,
    foodCount: world.foods.length,
    elapsedTime: world.elapsedTime,
    averageSpeed: totals.speed / population,
    averageVision: totals.vision / population,
    averageEnergy: totals.energy / population,
  };
}

export function calculateGeneStats(world) {
  const population = world.creatures.length;
  const genes = Object.fromEntries(
    GENE_KEYS.map((key) => [
      key,
      {
        average: 0,
        min: 0,
        max: 0,
      },
    ]),
  );

  if (population === 0) {
    return {
      population,
      genes,
    };
  }

  for (const key of GENE_KEYS) {
    let total = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const creature of world.creatures) {
      const value = creature[key];
      total += value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }

    genes[key] = {
      average: total / population,
      min,
      max,
    };
  }

  return {
    population,
    genes,
  };
}

export function calculateLineageStats(world) {
  const population = world.creatures.length;

  if (population === 0) {
    return {
      population,
      highestGeneration: 0,
      averageGeneration: 0,
      dominantGeneration: 0,
      recentBirths: 0,
      recentDeaths: 0,
      liveLineageCount: 0,
      topLineages: [],
      generationDistribution: [],
      lineageDistribution: [],
    };
  }

  const generationCounts = new Map();
  const lineageCounts = new Map();
  let highestGeneration = 0;
  let generationTotal = 0;

  for (const creature of world.creatures) {
    const generation = creature.generation ?? 0;
    const lineageId = creature.lineageId ?? creature.id;

    highestGeneration = Math.max(highestGeneration, generation);
    generationTotal += generation;
    generationCounts.set(generation, (generationCounts.get(generation) ?? 0) + 1);
    lineageCounts.set(lineageId, (lineageCounts.get(lineageId) ?? 0) + 1);
  }

  const dominantGeneration = [...generationCounts.entries()].sort(
    ([leftGeneration, leftCount], [rightGeneration, rightCount]) =>
      rightCount - leftCount || leftGeneration - rightGeneration,
  )[0][0];
  const topLineages = [...lineageCounts.entries()]
    .sort(([leftId, leftCount], [rightId, rightCount]) =>
      rightCount - leftCount || leftId - rightId,
    )
    .slice(0, 5)
    .map(([id, count]) => ({
      id,
      count,
      percent: count / population,
    }));
  const recentEvents = world.lifecycleHistory.slice(-LINEAGE_RECENT_WINDOW);
  const recentBirths = recentEvents.reduce((sum, event) => sum + event.births, 0);
  const recentDeaths = recentEvents.reduce((sum, event) => sum + event.deaths, 0);

  return {
    population,
    highestGeneration,
    averageGeneration: generationTotal / population,
    dominantGeneration,
    recentBirths,
    recentDeaths,
    liveLineageCount: lineageCounts.size,
    topLineages,
    generationDistribution: [...generationCounts.entries()]
      .sort(([leftGeneration], [rightGeneration]) => leftGeneration - rightGeneration)
      .map(([generation, count]) => ({
        generation,
        count,
        percent: count / population,
      })),
    lineageDistribution: [...lineageCounts.entries()]
      .sort(([leftId, leftCount], [rightId, rightCount]) =>
        rightCount - leftCount || leftId - rightId,
      )
      .map(([id, count]) => ({
        id,
        count,
        percent: count / population,
      })),
  };
}

export function dropFoodBatch(world, amount = 55) {
  let added = 0;

  while (added < amount && world.foods.length < MAX_FOOD_COUNT) {
    addFood(world);
    added += 1;
  }

  return added;
}

export function removeHalfFood(world) {
  const removeCount = Math.floor(world.foods.length / 2);

  for (let index = 0; index < removeCount; index += 1) {
    const foodIndex = Math.floor(Math.random() * world.foods.length);
    world.foods.splice(foodIndex, 1);
  }

  return removeCount;
}

export function applyEnvironmentalShock(world, deathRate = 0.3) {
  const removeCount = Math.round(world.creatures.length * deathRate);

  for (let index = 0; index < removeCount; index += 1) {
    const creatureIndex = Math.floor(Math.random() * world.creatures.length);
    world.creatures.splice(creatureIndex, 1);
  }

  if (removeCount > 0) {
    recordLifecycle(world, 0, removeCount);
  }

  return removeCount;
}

function recordLifecycle(world, births, deaths) {
  world.lifecycleHistory.push({
    tick: world.tick,
    births,
    deaths,
  });

  if (world.lifecycleHistory.length > MAX_LIFECYCLE_HISTORY_POINTS) {
    world.lifecycleHistory.splice(
      0,
      world.lifecycleHistory.length - MAX_LIFECYCLE_HISTORY_POINTS,
    );
  }
}

function updateCreature(creature, world, deltaSeconds) {
  creature.age += deltaSeconds;

  const targetFood = findNearestVisibleFood(creature, world.foods);

  if (targetFood) {
    creature.heading = Math.atan2(
      targetFood.y - creature.y,
      targetFood.x - creature.x,
    );
  } else {
    creature.heading += randomRange(-1, 1) * WANDER_TURN_RATE * deltaSeconds;
  }

  const moveDistance = creature.speed * deltaSeconds;
  creature.x += Math.cos(creature.heading) * moveDistance;
  creature.y += Math.sin(creature.heading) * moveDistance;
  keepCreatureInBounds(creature);

  const speedCostMultiplier = 1 + Math.max(
    0,
    (creature.speed - SPEED_COST_REFERENCE) / SPEED_COST_REFERENCE,
  ) * SPEED_COST_SCALE;
  const visionMetabolicCost = Math.max(
    0,
    creature.vision - VISION_COST_REFERENCE,
  ) * VISION_COST_PER_POINT;

  creature.energy -=
    moveDistance * ENERGY_COST_PER_DISTANCE * speedCostMultiplier +
    (BASE_ENERGY_COST_PER_SECOND + visionMetabolicCost) * deltaSeconds;

  if (targetFood && canEat(creature, targetFood)) {
    const foodIndex = world.foods.indexOf(targetFood);

    if (foodIndex !== -1) {
      world.foods.splice(foodIndex, 1);
      creature.energy += FOOD_ENERGY;
    }
  }
}

function findNearestVisibleFood(creature, foods) {
  const visionSquared = creature.vision * creature.vision;
  let closestFood = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const food of foods) {
    const currentDistance = distanceSquared(creature, food);

    if (currentDistance <= visionSquared && currentDistance < closestDistance) {
      closestFood = food;
      closestDistance = currentDistance;
    }
  }

  return closestFood;
}

function canEat(creature, food) {
  const eatDistance = CREATURE_RADIUS + 4;

  return distanceSquared(creature, food) <= eatDistance * eatDistance;
}

function keepCreatureInBounds(creature) {
  const previousX = creature.x;
  const previousY = creature.y;

  creature.x = clamp(creature.x, CREATURE_RADIUS, WORLD_WIDTH - CREATURE_RADIUS);
  creature.y = clamp(creature.y, CREATURE_RADIUS, WORLD_HEIGHT - CREATURE_RADIUS);

  if (creature.x !== previousX) {
    creature.heading = Math.PI - creature.heading;
  }

  if (creature.y !== previousY) {
    creature.heading = -creature.heading;
  }
}

function spawnFood(world, settings, deltaSeconds) {
  if (world.foods.length >= MAX_FOOD_COUNT) {
    return;
  }

  const environmentState = getEnvironmentState(
    settings.environmentMode,
    world.elapsedTime,
  );
  world.foodSpawnAccumulator +=
    settings.foodSpawnRate * environmentState.spawnMultiplier * deltaSeconds;

  while (
    world.foodSpawnAccumulator >= 1 &&
    world.foods.length < MAX_FOOD_COUNT
  ) {
    addFood(world, environmentState);
    world.foodSpawnAccumulator -= 1;
  }
}

function addFood(world, environmentState = getEnvironmentState()) {
  world.foods.push(
    createFood(world.nextFoodId, createFoodPosition(environmentState)),
  );
  world.nextFoodId += 1;
}
