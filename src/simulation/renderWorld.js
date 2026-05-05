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
  context.fillStyle = '#0f151c';
  context.fillRect(0, 0, width, height);

  const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  const worldPixelWidth = WORLD_WIDTH * scale;
  const worldPixelHeight = WORLD_HEIGHT * scale;

  context.save();
  context.scale(scale, scale);

  drawGrid(context);
  drawPatchBoundaries(context, environmentState);
  drawFoods(context, world.foods);
  drawCreatures(context, world.creatures, displayMode);
  drawWorldBorder(context);

  context.restore();
  drawCanvasHud(context, world, environmentState, displayMode, {
    width,
    height,
    worldPixelWidth,
    worldPixelHeight,
  });
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

    if (isDominantLineage) {
      drawDominantGlow(context, creature, creatureColor);
    }

    context.beginPath();
    context.fillStyle = creatureColor;
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

function drawDominantGlow(context, creature, creatureColor) {
  context.save();
  context.globalAlpha = 0.48;
  context.shadowColor = creatureColor;
  context.shadowBlur = 12;
  context.strokeStyle = creatureColor;
  context.lineWidth = 3.2;
  context.beginPath();
  context.arc(creature.x, creature.y, CREATURE_RADIUS + 4.6, 0, Math.PI * 2);
  context.stroke();

  context.globalAlpha = 0.26;
  context.shadowBlur = 18;
  context.lineWidth = 5.4;
  context.beginPath();
  context.arc(creature.x, creature.y, CREATURE_RADIUS + 5.6, 0, Math.PI * 2);
  context.stroke();
  context.restore();
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

function drawCanvasHud(context, world, environmentState, displayMode, layout) {
  const rightSpace = layout.width - layout.worldPixelWidth;
  const bottomSpace = layout.height - layout.worldPixelHeight;

  if (rightSpace >= 210) {
    drawSideHud(context, world, environmentState, displayMode, {
      x: layout.worldPixelWidth + 12,
      y: 12,
      width: rightSpace - 24,
      height: Math.min(layout.worldPixelHeight - 24, layout.height - 24),
    });
  }

  if (bottomSpace >= 78) {
    drawBottomHud(context, world, displayMode, {
      x: 12,
      y: layout.worldPixelHeight + 12,
      width: Math.min(layout.worldPixelWidth - 24, layout.width - 24),
      height: bottomSpace - 24,
    });
  }
}

function drawSideHud(context, world, environmentState, displayMode, panel) {
  const stats = calculateHudStats(world);
  drawPanel(context, panel);
  drawText(context, '地图信息', panel.x + 16, panel.y + 26, {
    color: '#eaf8ff',
    size: 15,
    weight: 800,
  });
  drawPill(
    context,
    getDisplayModeLabel(displayMode),
    panel.x + panel.width - 94,
    panel.y + 12,
    78,
    '#0e4f78',
  );

  const environmentText = environmentState?.seasonLabel
    ? `${environmentState.label} / ${environmentState.seasonLabel}`
    : environmentState?.label ?? '普通环境';
  drawText(context, environmentText, panel.x + 16, panel.y + 52, {
    color: '#88aabd',
    size: 12,
    weight: 700,
  });

  const metricY = panel.y + 78;
  drawMetric(context, '种群', stats.population, panel.x + 16, metricY);
  drawMetric(context, '食物', stats.foodCount, panel.x + panel.width / 2 + 2, metricY);
  drawMetric(context, '均速', stats.averageSpeed.toFixed(1), panel.x + 16, metricY + 58);
  drawMetric(
    context,
    '视野',
    stats.averageVision.toFixed(1),
    panel.x + panel.width / 2 + 2,
    metricY + 58,
  );

  const lineageY = metricY + 138;
  drawText(context, '最优谱系', panel.x + 16, lineageY, {
    color: '#eaf8ff',
    size: 13,
    weight: 800,
  });

  if (stats.topLineages.length === 0) {
    drawText(context, '种群已灭绝', panel.x + 16, lineageY + 28, {
      color: '#ffd3df',
      size: 13,
      weight: 800,
    });
    return;
  }

  const dominantLineage = stats.topLineages[0];
  drawLineageRow(context, dominantLineage, stats.population, panel.x + 16, lineageY + 26, {
    dominant: true,
    width: panel.width - 32,
  });

  drawText(context, '谱系排行', panel.x + 16, lineageY + 70, {
    color: '#88aabd',
    size: 12,
    weight: 800,
  });

  const availableRows = Math.max(
    0,
    Math.min(4, Math.floor((panel.y + panel.height - (lineageY + 94)) / 26)),
  );

  stats.topLineages.slice(1, 1 + availableRows).forEach((lineage, index) => {
    drawLineageRow(
      context,
      lineage,
      stats.population,
      panel.x + 16,
      lineageY + 94 + index * 26,
      {
        width: panel.width - 32,
      },
    );
  });
}

function drawBottomHud(context, world, displayMode, panel) {
  const stats = calculateHudStats(world);
  drawPanel(context, panel);
  drawText(context, '图例', panel.x + 14, panel.y + 24, {
    color: '#eaf8ff',
    size: 13,
    weight: 800,
  });
  drawLegendDot(context, '#45d65d', '食物', panel.x + 68, panel.y + 20);
  drawLegendDot(
    context,
    displayMode === 'normal' ? '#4aa8ff' : '#ffd876',
    getDisplayModeLabel(displayMode),
    panel.x + 138,
    panel.y + 20,
  );
  drawText(
    context,
    `出生个体会继承亲代谱系；高亮外圈代表当前最优谱系。当前存活谱系 ${stats.lineageCount}`,
    panel.x + 14,
    panel.y + 50,
    {
      color: '#88aabd',
      size: 12,
      weight: 700,
    },
  );
}

function calculateHudStats(world) {
  const population = world.creatures.length;
  const totals = world.creatures.reduce(
    (sum, creature) => ({
      speed: sum.speed + creature.speed,
      vision: sum.vision + creature.vision,
    }),
    { speed: 0, vision: 0 },
  );
  const lineageCounts = new Map();

  for (const creature of world.creatures) {
    const lineageId = creature.lineageId ?? creature.id;
    lineageCounts.set(lineageId, (lineageCounts.get(lineageId) ?? 0) + 1);
  }

  const topLineages = [...lineageCounts.entries()]
    .sort(([leftId, leftCount], [rightId, rightCount]) =>
      rightCount - leftCount || leftId - rightId,
    )
    .slice(0, 5)
    .map(([id, count]) => ({
      id,
      count,
    }));

  return {
    population,
    foodCount: world.foods.length,
    averageSpeed: population > 0 ? totals.speed / population : 0,
    averageVision: population > 0 ? totals.vision / population : 0,
    lineageCount: lineageCounts.size,
    topLineages,
  };
}

function drawMetric(context, label, value, x, y) {
  context.save();
  roundedRect(context, x, y, 92, 46, 7);
  context.fillStyle = 'rgba(13, 23, 33, 0.95)';
  context.fill();
  context.strokeStyle = 'rgba(86, 132, 166, 0.42)';
  context.stroke();
  drawText(context, label, x + 10, y + 15, {
    color: '#80a6be',
    size: 11,
    weight: 800,
  });
  drawText(context, String(value), x + 10, y + 35, {
    color: '#77e6ff',
    family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    size: 18,
    weight: 900,
  });
  context.restore();
}

function drawLineageRow(context, lineage, population, x, y, options = {}) {
  const width = options.width ?? 160;
  const color = getLineageColor(lineage.id);
  const percent = population > 0 ? lineage.count / population : 0;
  const rowHeight = options.dominant ? 32 : 22;
  const centerY = y;

  context.save();

  if (options.dominant) {
    roundedRect(context, x - 6, centerY - rowHeight / 2, width + 12, rowHeight, 7);
    context.fillStyle = 'rgba(255, 216, 118, 0.08)';
    context.fill();
    context.strokeStyle = 'rgba(255, 216, 118, 0.34)';
    context.stroke();
  }

  context.beginPath();
  context.fillStyle = color;
  context.arc(x, centerY, options.dominant ? 5 : 4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  context.stroke();

  drawText(context, `L${lineage.id}`, x + 12, centerY, {
    baseline: 'middle',
    color: '#d9f6ff',
    family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    size: 12,
    weight: 800,
  });

  if (options.dominant) {
    drawPill(context, '最优', x + 58, centerY - 11, 38, '#7b5b12');
  }

  drawText(context, `${lineage.count} / ${(percent * 100).toFixed(0)}%`, x + width - 62, centerY, {
    baseline: 'middle',
    color: '#77e6ff',
    family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    size: 12,
    weight: 900,
  });
  context.restore();
}

function drawLegendDot(context, color, label, x, y) {
  context.beginPath();
  context.fillStyle = color;
  context.arc(x, y, 4, 0, Math.PI * 2);
  context.fill();
  drawText(context, label, x + 9, y + 4, {
    color: '#bfd5e4',
    size: 12,
    weight: 800,
  });
}

function drawPanel(context, panel) {
  context.save();
  roundedRect(context, panel.x, panel.y, panel.width, panel.height, 10);
  context.fillStyle = 'rgba(8, 13, 19, 0.88)';
  context.fill();
  context.strokeStyle = 'rgba(105, 215, 255, 0.18)';
  context.stroke();
  context.restore();
}

function drawPill(context, label, x, y, width, color) {
  context.save();
  roundedRect(context, x, y, width, 22, 999);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(105, 215, 255, 0.32)';
  context.stroke();
  drawText(context, label, x + width / 2, y + 11, {
    align: 'center',
    baseline: 'middle',
    color: '#eaf8ff',
    size: 11,
    weight: 900,
  });
  context.restore();
}

function drawText(context, text, x, y, options = {}) {
  context.save();
  context.fillStyle = options.color ?? '#d9f6ff';
  context.font = `${options.weight ?? 700} ${options.size ?? 12}px ${options.family ?? 'Inter, system-ui, sans-serif'}`;
  context.textAlign = options.align ?? 'left';
  context.textBaseline = options.baseline ?? 'alphabetic';
  context.fillText(text, x, y);
  context.restore();
}

function roundedRect(context, x, y, width, height, radius) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - resolvedRadius, y + height);
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
}

function getDisplayModeLabel(displayMode) {
  if (displayMode === 'generation') {
    return '世代';
  }

  if (displayMode === 'lineage') {
    return '谱系';
  }

  return '普通';
}
