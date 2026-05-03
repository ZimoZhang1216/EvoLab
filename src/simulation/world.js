import {
  BASE_ENERGY_COST_PER_SECOND,
  CREATURE_RADIUS,
  ENERGY_COST_PER_DISTANCE,
  FOOD_ENERGY,
  INITIAL_CREATURE_COUNT,
  INITIAL_FOOD_COUNT,
  MAX_CREATURE_COUNT,
  MAX_FOOD_COUNT,
  WANDER_TURN_RATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.js';
import { createCreature, createFood, reproduceCreature } from './entities.js';
import { clamp, distanceSquared, randomRange } from './random.js';

export function createWorld(settings) {
  const world = {
    tick: 0,
    foodSpawnAccumulator: 0,
    nextCreatureId: 1,
    nextFoodId: 1,
    creatures: [],
    foods: [],
  };

  for (let index = 0; index < INITIAL_CREATURE_COUNT; index += 1) {
    world.creatures.push(createCreature(world.nextCreatureId, settings));
    world.nextCreatureId += 1;
  }

  for (let index = 0; index < INITIAL_FOOD_COUNT; index += 1) {
    addFood(world);
  }

  return world;
}

export function stepWorld(world, settings, deltaSeconds) {
  world.tick += 1;
  spawnFood(world, settings, deltaSeconds);

  const survivors = [];
  const births = [];

  for (const creature of world.creatures) {
    updateCreature(creature, world, deltaSeconds);

    if (creature.energy <= 0 || creature.age > creature.lifespan) {
      continue;
    }

    if (
      creature.energy > creature.reproductionThreshold &&
      survivors.length + births.length < MAX_CREATURE_COUNT
    ) {
      const child = reproduceCreature(creature, world.nextCreatureId, settings);
      world.nextCreatureId += 1;
      creature.energy *= 0.55;
      births.push(child);
    }

    survivors.push(creature);
  }

  world.creatures = survivors.concat(births);
}

export function calculateStats(world) {
  const population = world.creatures.length;

  if (population === 0) {
    return {
      population,
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
    averageSpeed: totals.speed / population,
    averageVision: totals.vision / population,
    averageEnergy: totals.energy / population,
  };
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

  creature.energy -=
    moveDistance * ENERGY_COST_PER_DISTANCE + BASE_ENERGY_COST_PER_SECOND * deltaSeconds;

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

  world.foodSpawnAccumulator += settings.foodSpawnRate * deltaSeconds;

  while (
    world.foodSpawnAccumulator >= 1 &&
    world.foods.length < MAX_FOOD_COUNT
  ) {
    addFood(world);
    world.foodSpawnAccumulator -= 1;
  }
}

function addFood(world) {
  world.foods.push(createFood(world.nextFoodId));
  world.nextFoodId += 1;
}
