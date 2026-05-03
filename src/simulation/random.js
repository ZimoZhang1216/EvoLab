export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function randomHeading() {
  return randomRange(0, Math.PI * 2);
}

export function mutateTrait(value, mutationRate, limits) {
  const [min, max] = limits;
  const span = max - min;
  const change = randomRange(-1, 1) * span * mutationRate * 0.18;

  return clamp(value + change, min, max);
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return dx * dx + dy * dy;
}
