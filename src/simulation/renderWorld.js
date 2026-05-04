import {
  CREATURE_RADIUS,
  FOOD_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.js';
import { FOOD_PATCHES, FOOD_PATCH_RADIUS } from './environmentModes.js';

const LINEAGE_COLORS = [
  '#4aa8ff',
  '#7cffb2',
  '#ffd876',
  '#b68cff',
  '#ff8fb1',
  '#5eead4',
  '#f97316',
  '#a3e635',
  '#38bdf8',
  '#f472b6',
];

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

  for (const creature of creatures) {
    context.beginPath();
    context.fillStyle = getCreatureColor(creature, displayMode, maxGeneration);
    context.arc(creature.x, creature.y, CREATURE_RADIUS, 0, Math.PI * 2);
    context.fill();

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
    const colorIndex = Math.abs(lineageId) % LINEAGE_COLORS.length;

    return LINEAGE_COLORS[colorIndex];
  }

  return '#4aa8ff';
}

function drawWorldBorder(context) {
  context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  context.lineWidth = 2;
  context.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}
