import {
  CREATURE_RADIUS,
  FOOD_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.js';
import { FOOD_PATCHES, FOOD_PATCH_RADIUS } from './environmentModes.js';
import { getLineageColor } from './lineageColors.js';

export function drawWorld(canvas, world, environmentState, displayMode = 'normal') {
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(height * pixelRatio));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#14171a';
  context.fillRect(0, 0, width, height);

  const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  const worldPixelWidth = WORLD_WIDTH * scale;
  const worldPixelHeight = WORLD_HEIGHT * scale;
  const offsetX = (width - worldPixelWidth) / 2;
  const offsetY = (height - worldPixelHeight) / 2;

  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);

  drawGrid(context);
  drawPatchBoundaries(context, environmentState);
  drawFoods(context, world.foods);
  drawCreatures(context, world.creatures, displayMode);
  drawWorldBorder(context);

  context.restore();
}

function drawPatchBoundaries(context, environmentState) {
  if (environmentState?.id !== 'patchy') {
    return;
  }

  for (const patch of FOOD_PATCHES) {
    context.beginPath();
    context.fillStyle = 'rgba(69, 214, 93, 0.055)';
    context.arc(patch.x, patch.y, FOOD_PATCH_RADIUS, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.strokeStyle = 'rgba(93, 255, 134, 0.45)';
    context.lineWidth = 2;
    context.setLineDash([10, 8]);
    context.arc(patch.x, patch.y, FOOD_PATCH_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);

    context.beginPath();
    context.fillStyle = 'rgba(183, 255, 211, 0.78)';
    context.arc(patch.x, patch.y, 4, 0, Math.PI * 2);
    context.fill();
  }
}

function drawGrid(context) {
  context.strokeStyle = 'rgba(255, 255, 255, 0.045)';
  context.lineWidth = 1;

  for (let x = 0; x <= WORLD_WIDTH; x += 50) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, WORLD_HEIGHT);
    context.stroke();
  }

  for (let y = 0; y <= WORLD_HEIGHT; y += 50) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
    context.stroke();
  }
}

function drawFoods(context, foods) {
  context.fillStyle = '#45d65d';

  for (const food of foods) {
    context.beginPath();
    context.arc(food.x, food.y, FOOD_RADIUS, 0, Math.PI * 2);
    context.fill();
  }
}

function drawCreatures(context, creatures, displayMode) {
  const maxGeneration = creatures.reduce(
    (max, creature) => Math.max(max, creature.generation ?? 0),
    0,
  );
  const dominantLineageId =
    displayMode === 'lineage' ? getDominantLineageId(creatures) : null;

  for (const creature of creatures) {
    const creatureColor = getCreatureColor(creature, displayMode, maxGeneration);
    const isDominantLineage =
      displayMode === 'lineage' &&
      (creature.lineageId ?? creature.id) === dominantLineageId;

    context.beginPath();
    context.fillStyle = creatureColor;
    context.arc(creature.x, creature.y, CREATURE_RADIUS, 0, Math.PI * 2);
    context.fill();

    if (isDominantLineage) {
      context.beginPath();
      context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      context.lineWidth = 1.4;
      context.arc(creature.x, creature.y, CREATURE_RADIUS + 2.2, 0, Math.PI * 2);
      context.stroke();

      context.beginPath();
      context.strokeStyle = creatureColor;
      context.lineWidth = 0.9;
      context.arc(creature.x, creature.y, CREATURE_RADIUS + 3.8, 0, Math.PI * 2);
      context.stroke();
    }

    context.beginPath();
    context.fillStyle = 'rgba(255, 255, 255, 0.64)';
    context.arc(
      creature.x + Math.cos(creature.heading) * CREATURE_RADIUS * 0.78,
      creature.y + Math.sin(creature.heading) * CREATURE_RADIUS * 0.78,
      1.15,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function getCreatureColor(creature, displayMode, maxGeneration) {
  if (displayMode === 'generation') {
    const ratio = maxGeneration > 0 ? (creature.generation ?? 0) / maxGeneration : 0;
    const hue = 208 - ratio * 168;
    const lightness = 58 + ratio * 8;

    return `hsl(${hue}, 94%, ${lightness}%)`;
  }

  if (displayMode === 'lineage') {
    const lineageId = creature.lineageId ?? creature.id;
    return getLineageColor(lineageId);
  }

  return '#4aa8ff';
}

function getDominantLineageId(creatures) {
  const lineageCounts = new Map();

  for (const creature of creatures) {
    const lineageId = creature.lineageId ?? creature.id;
    lineageCounts.set(lineageId, (lineageCounts.get(lineageId) ?? 0) + 1);
  }

  let dominantId = null;
  let dominantCount = 0;

  for (const [lineageId, count] of lineageCounts) {
    if (
      count > dominantCount ||
      (count === dominantCount && (dominantId === null || lineageId < dominantId))
    ) {
      dominantId = lineageId;
      dominantCount = count;
    }
  }

  return dominantId;
}

function drawWorldBorder(context) {
  context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  context.lineWidth = 2;
  context.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}
