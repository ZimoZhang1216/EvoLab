export const LINEAGE_COLORS = [
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

export function getLineageColor(lineageId) {
  return LINEAGE_COLORS[Math.abs(Number(lineageId) || 0) % LINEAGE_COLORS.length];
}
