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
const LINEAGE_ADVANTAGE_WINDOW = 300;

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
  const lifecycleEvent = createLifecycleEvent(world.tick);
  let deaths = 0;

  for (const creature of world.creatures) {
    updateCreature(creature, world, deltaSeconds, lifecycleEvent);

    if (creature.energy <= 0 || creature.age > creature.lifespan) {
      deaths += 1;
      recordLineageEvent(lifecycleEvent, getCreatureLineageId(creature), 'deaths');
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
      recordLineageEvent(lifecycleEvent, getCreatureLineageId(creature), 'births');
      recordLineageEvent(
        lifecycleEvent,
        getCreatureLineageId(creature),
        'reproductions',
      );
      births.push(child);
    }

    survivors.push(creature);
  }

  world.creatures = survivors.concat(births);
  recordLifecycle(world, lifecycleEvent);
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

export function calculateLineageAdvantageStats(world) {
  const population = world.creatures.length;

  if (population === 0) {
    return {
      population,
      windowSize: Math.min(world.lifecycleHistory.length, LINEAGE_ADVANTAGE_WINDOW),
      overall: createEmptyLineageAverages(),
      lineages: [],
    };
  }

  const lineageBuckets = new Map();
  const overallTotals = createLineageTotals();

  for (const creature of world.creatures) {
    const lineageId = getCreatureLineageId(creature);
    const bucket = getLineageBucket(lineageBuckets, lineageId);

    addCreatureToLineageTotals(bucket.totals, creature);
    addCreatureToLineageTotals(overallTotals, creature);
    bucket.count += 1;
  }

  const recentEvents = world.lifecycleHistory.slice(-LINEAGE_ADVANTAGE_WINDOW);

  for (const event of recentEvents) {
    for (const [lineageId, lineageEvent] of Object.entries(event.lineages ?? {})) {
      const numericLineageId = Number(lineageId);
      const bucket = getLineageBucket(lineageBuckets, numericLineageId);

      bucket.recent.births += lineageEvent.births ?? 0;
      bucket.recent.deaths += lineageEvent.deaths ?? 0;
      bucket.recent.foodEaten += lineageEvent.foodEaten ?? 0;
      bucket.recent.reproductions += lineageEvent.reproductions ?? 0;
    }
  }

  return {
    population,
    windowSize: recentEvents.length,
    overall: calculateLineageAverages(overallTotals, population),
    lineages: [...lineageBuckets.values()]
      .filter((lineage) => lineage.count > 0)
      .sort((left, right) => right.count - left.count || left.id - right.id)
      .slice(0, 5)
      .map((lineage) => ({
        id: lineage.id,
        count: lineage.count,
        percent: lineage.count / population,
        averages: calculateLineageAverages(lineage.totals, lineage.count),
        recent: {
          ...lineage.recent,
          netGrowth: lineage.recent.births - lineage.recent.deaths,
        },
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
  const lifecycleEvent = createLifecycleEvent(world.tick);

  for (let index = 0; index < removeCount; index += 1) {
    const creatureIndex = Math.floor(Math.random() * world.creatures.length);
    const creature = world.creatures[creatureIndex];

    if (creature) {
      recordLineageEvent(lifecycleEvent, getCreatureLineageId(creature), 'deaths');
    }

    world.creatures.splice(creatureIndex, 1);
  }

  if (removeCount > 0) {
    recordLifecycle(world, lifecycleEvent);
  }

  return removeCount;
}

function createLifecycleEvent(tick) {
  return {
    tick,
    births: 0,
    deaths: 0,
    foodEaten: 0,
    reproductions: 0,
    lineages: {},
  };
}

function recordLineageEvent(event, lineageId, type, amount = 1) {
  if (!event || !Number.isFinite(Number(lineageId))) {
    return;
  }

  const key = String(lineageId);

  if (!event.lineages[key]) {
    event.lineages[key] = {
      births: 0,
      deaths: 0,
      foodEaten: 0,
      reproductions: 0,
    };
  }

  event[type] += amount;
  event.lineages[key][type] += amount;
}

function recordLifecycle(world, event) {
  world.lifecycleHistory.push(event);

  if (world.lifecycleHistory.length > MAX_LIFECYCLE_HISTORY_POINTS) {
    world.lifecycleHistory.splice(
      0,
      world.lifecycleHistory.length - MAX_LIFECYCLE_HISTORY_POINTS,
    );
  }
}

function updateCreature(creature, world, deltaSeconds, lifecycleEvent) {
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
      recordLineageEvent(
        lifecycleEvent,
        getCreatureLineageId(creature),
        'foodEaten',
      );
    }
  }
}

function getCreatureLineageId(creature) {
  return creature.lineageId ?? creature.id;
}

function createLineageTotals() {
  return {
    speed: 0,
    vision: 0,
    reproductionThreshold: 0,
    lifespan: 0,
    mutationRate: 0,
    energy: 0,
    age: 0,
  };
}

function createEmptyLineageAverages() {
  return {
    speed: 0,
    vision: 0,
    reproductionThreshold: 0,
    lifespan: 0,
    mutationRate: 0,
    energy: 0,
    age: 0,
  };
}

function getLineageBucket(lineageBuckets, lineageId) {
  const normalizedLineageId = Number(lineageId);

  if (!lineageBuckets.has(normalizedLineageId)) {
    lineageBuckets.set(normalizedLineageId, {
      id: normalizedLineageId,
      count: 0,
      totals: createLineageTotals(),
      recent: {
        births: 0,
        deaths: 0,
        foodEaten: 0,
        reproductions: 0,
      },
    });
  }

  return lineageBuckets.get(normalizedLineageId);
}

function addCreatureToLineageTotals(totals, creature) {
  totals.speed += creature.speed;
  totals.vision += creature.vision;
  totals.reproductionThreshold += creature.reproductionThreshold;
  totals.lifespan += creature.lifespan;
  totals.mutationRate += creature.mutationRate;
  totals.energy += creature.energy;
  totals.age += creature.age;
}

function calculateLineageAverages(totals, count) {
  if (count === 0) {
    return createEmptyLineageAverages();
  }

  return {
    speed: totals.speed / count,
    vision: totals.vision / count,
    reproductionThreshold: totals.reproductionThreshold / count,
    lifespan: totals.lifespan / count,
    mutationRate: totals.mutationRate / count,
    energy: totals.energy / count,
    age: totals.age / count,
  };
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
