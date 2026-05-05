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
const BRANCH_RECENT_WINDOW = 300;
const MUTATION_STORM_BRANCH_THRESHOLD_MULTIPLIER = 0.6;
const MUTATION_STORM_BRANCH_CHANCE = 0.35;
const SIGNIFICANT_MUTATION_THRESHOLDS = {
  speed: 4.6,
  vision: 10,
  reproductionThreshold: 7.5,
  lifespan: 9,
  mutationRate: 0.035,
};

export function createWorld(settings) {
  const world = {
    tick: 0,
    elapsedTime: 0,
    foodSpawnAccumulator: 0,
    nextCreatureId: 1,
    nextFoodId: 1,
    nextBranchId: 1,
    branchRegistry: {},
    lifecycleHistory: [],
    creatures: [],
    foods: [],
  };

  for (let index = 0; index < INITIAL_CREATURE_COUNT; index += 1) {
    const creatureId = world.nextCreatureId;
    const branchId = world.nextBranchId;

    world.creatures.push(
      createCreature(creatureId, settings, {
        generation: 0,
        lineageId: creatureId,
        branchId,
        parentBranchId: null,
        branchBirthTick: world.tick,
        parentId: null,
        birthTick: world.tick,
      }),
    );
    world.branchRegistry[branchId] = {
      id: branchId,
      lineageId: creatureId,
      parentBranchId: null,
      birthTick: world.tick,
    };
    world.nextCreatureId += 1;
    world.nextBranchId += 1;
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
      recordBranchEvent(lifecycleEvent, getCreatureBranchId(creature), 'deaths');
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
      assignMutationBranchIfNeeded(world, creature, child, settings, lifecycleEvent);
      creature.energy *= 0.55;
      recordLineageEvent(lifecycleEvent, getCreatureLineageId(child), 'births');
      recordLineageEvent(
        lifecycleEvent,
        getCreatureLineageId(creature),
        'reproductions',
      );
      recordBranchEvent(lifecycleEvent, getCreatureBranchId(child), 'births');
      recordBranchEvent(
        lifecycleEvent,
        getCreatureBranchId(creature),
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

export function calculateBranchStats(world) {
  const population = world.creatures.length;
  const recentEvents = world.lifecycleHistory.slice(-BRANCH_RECENT_WINDOW);
  const recentNewBranches = recentEvents.reduce(
    (sum, event) => sum + (event.newBranches ?? 0),
    0,
  );
  const recentNetGrowth = recentEvents.reduce(
    (sum, event) => sum + (event.births ?? 0) - (event.deaths ?? 0),
    0,
  );
  const previousPopulation = Math.max(0, population - recentNetGrowth);

  if (population === 0) {
    return {
      population,
      windowSize: recentEvents.length,
      activeBranchCount: 0,
      historicalBranchCount: getHistoricalBranchCount(world),
      recentNewBranches,
      topBranches: [],
    };
  }

  const branchBuckets = new Map();

  for (const creature of world.creatures) {
    const branchId = getCreatureBranchId(creature);
    const bucket = getBranchBucket(branchBuckets, world, branchId, {
      lineageId: getCreatureLineageId(creature),
      parentBranchId: creature.parentBranchId ?? null,
      birthTick: creature.branchBirthTick ?? 0,
    });

    addCreatureToLineageTotals(bucket.totals, creature);
    bucket.count += 1;
  }

  for (const event of recentEvents) {
    for (const [branchId, branchEvent] of Object.entries(event.branches ?? {})) {
      const bucket = getBranchBucket(branchBuckets, world, Number(branchId));

      bucket.recent.births += branchEvent.births ?? 0;
      bucket.recent.deaths += branchEvent.deaths ?? 0;
      bucket.recent.foodEaten += branchEvent.foodEaten ?? 0;
      bucket.recent.reproductions += branchEvent.reproductions ?? 0;
      bucket.recent.newBranches += branchEvent.newBranches ?? 0;
    }
  }

  const activeBranches = [...branchBuckets.values()].filter(
    (branch) => branch.count > 0,
  );

  return {
    population,
    windowSize: recentEvents.length,
    activeBranchCount: activeBranches.length,
    historicalBranchCount: getHistoricalBranchCount(world),
    recentNewBranches,
    topBranches: activeBranches
      .sort((left, right) => right.count - left.count || left.id - right.id)
      .slice(0, 5)
      .map((branch) => {
        const recent = {
          ...branch.recent,
          netGrowth: branch.recent.births - branch.recent.deaths,
        };
        const previousCount = Math.max(0, branch.count - recent.netGrowth);
        const previousPercent =
          previousPopulation > 0 ? previousCount / previousPopulation : 0;
        const percent = branch.count / population;

        return {
          id: branch.id,
          lineageId: branch.lineageId,
          parentBranchId: branch.parentBranchId,
          birthTick: branch.birthTick,
          count: branch.count,
          percent,
          previousPercent,
          isExpanding: recent.netGrowth > 0 && percent > previousPercent + 0.01,
          averages: calculateLineageAverages(branch.totals, branch.count),
          recent,
        };
      }),
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
      recordBranchEvent(lifecycleEvent, getCreatureBranchId(creature), 'deaths');
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
    newBranches: 0,
    lineages: {},
    branches: {},
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

function recordBranchEvent(event, branchId, type, amount = 1) {
  if (!event || !Number.isFinite(Number(branchId))) {
    return;
  }

  const key = String(branchId);

  if (!event.branches[key]) {
    event.branches[key] = {
      births: 0,
      deaths: 0,
      foodEaten: 0,
      reproductions: 0,
      newBranches: 0,
    };
  }

  if (type === 'newBranches') {
    event.newBranches += amount;
  }

  event.branches[key][type] += amount;
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
      recordBranchEvent(lifecycleEvent, getCreatureBranchId(creature), 'foodEaten');
    }
  }
}

function getCreatureLineageId(creature) {
  return creature.lineageId ?? creature.id;
}

function getCreatureBranchId(creature) {
  return creature.branchId ?? creature.lineageId ?? creature.id;
}

function assignMutationBranchIfNeeded(world, parent, child, settings, lifecycleEvent) {
  if (!hasSignificantMutation(parent, child, settings)) {
    return;
  }

  const branchId = consumeNextBranchId(world);
  const parentBranchId = getCreatureBranchId(parent);

  child.branchId = branchId;
  child.parentBranchId = parentBranchId;
  child.branchBirthTick = world.tick;

  ensureBranchRegistry(world);
  world.branchRegistry[branchId] = {
    id: branchId,
    lineageId: getCreatureLineageId(child),
    parentBranchId,
    birthTick: world.tick,
  };

  recordBranchEvent(lifecycleEvent, branchId, 'newBranches');
}

function hasSignificantMutation(parent, child, settings) {
  const thresholdMultiplier = settings.isMutationStormActive
    ? MUTATION_STORM_BRANCH_THRESHOLD_MULTIPLIER
    : 1;
  const hasMajorGeneChange = GENE_KEYS.some((key) => {
    const threshold = SIGNIFICANT_MUTATION_THRESHOLDS[key] * thresholdMultiplier;

    return Math.abs((child[key] ?? 0) - (parent[key] ?? 0)) >= threshold;
  });

  if (!hasMajorGeneChange) {
    return false;
  }

  if (settings.isMutationStormActive) {
    return Math.random() < MUTATION_STORM_BRANCH_CHANCE;
  }

  return true;
}

function consumeNextBranchId(world) {
  ensureBranchRegistry(world);

  if (!Number.isFinite(world.nextBranchId)) {
    world.nextBranchId = getHistoricalBranchCount(world) + 1;
  }

  const branchId = world.nextBranchId;
  world.nextBranchId += 1;

  return branchId;
}

function ensureBranchRegistry(world) {
  if (!world.branchRegistry) {
    world.branchRegistry = {};
  }
}

function getHistoricalBranchCount(world) {
  const registryCount = Object.keys(world.branchRegistry ?? {}).length;

  if (registryCount > 0) {
    return registryCount;
  }

  const liveBranchIds = new Set(world.creatures.map((creature) => getCreatureBranchId(creature)));

  return Math.max(liveBranchIds.size, (world.nextBranchId ?? 1) - 1);
}

function getBranchBucket(branchBuckets, world, branchId, fallback = {}) {
  const normalizedBranchId = Number(branchId);
  const metadata = world.branchRegistry?.[normalizedBranchId] ?? {};

  if (!branchBuckets.has(normalizedBranchId)) {
    branchBuckets.set(normalizedBranchId, {
      id: normalizedBranchId,
      lineageId: fallback.lineageId ?? metadata.lineageId ?? null,
      parentBranchId: fallback.parentBranchId ?? metadata.parentBranchId ?? null,
      birthTick: fallback.birthTick ?? metadata.birthTick ?? 0,
      count: 0,
      totals: createLineageTotals(),
      recent: {
        births: 0,
        deaths: 0,
        foodEaten: 0,
        reproductions: 0,
        newBranches: 0,
      },
    });
  }

  const bucket = branchBuckets.get(normalizedBranchId);
  bucket.lineageId ??= fallback.lineageId ?? metadata.lineageId ?? null;
  bucket.parentBranchId ??= fallback.parentBranchId ?? metadata.parentBranchId ?? null;
  bucket.birthTick ??= fallback.birthTick ?? metadata.birthTick ?? 0;

  return bucket;
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
