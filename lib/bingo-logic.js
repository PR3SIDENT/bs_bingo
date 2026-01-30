// Shared bingo logic — used by serverless functions

export const GRID_TIERS = [
  { size: 3, need: 8 },
  { size: 4, need: 15 },
  { size: 5, need: 24 },
];

export function getGridSize(topicCount) {
  for (let i = GRID_TIERS.length - 1; i >= 0; i--) {
    if (topicCount >= GRID_TIERS[i].need) return GRID_TIERS[i].size;
  }
  return GRID_TIERS[0].size;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function checkBingo(cells, gridSize) {
  const markedSet = new Set();
  for (const c of cells) {
    if (c.marked) markedSet.add(c.cell_index);
  }

  const lines = [];

  // Rows
  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) row.push(r * gridSize + c);
    lines.push(row);
  }
  // Columns
  for (let c = 0; c < gridSize; c++) {
    const col = [];
    for (let r = 0; r < gridSize; r++) col.push(r * gridSize + c);
    lines.push(col);
  }
  // Diagonals
  const d1 = [], d2 = [];
  for (let i = 0; i < gridSize; i++) {
    d1.push(i * gridSize + i);
    d2.push(i * gridSize + (gridSize - 1 - i));
  }
  lines.push(d1, d2);

  for (const line of lines) {
    if (line.every((i) => markedSet.has(i))) {
      return { bingo: true, winningLine: line };
    }
  }
  return { bingo: false, winningLine: null };
}
