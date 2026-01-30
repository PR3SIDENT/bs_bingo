import { describe, it, expect } from 'vitest';
import { GRID_TIERS, getGridSize, shuffle, checkBingo } from '../lib/bingo-logic.js';

describe('GRID_TIERS', () => {
  it('has correct tier definitions', () => {
    expect(GRID_TIERS).toEqual([
      { size: 3, need: 8 },
      { size: 4, need: 15 },
      { size: 5, need: 24 },
    ]);
  });
});

describe('getGridSize', () => {
  it('returns 3 for 8 topics', () => {
    expect(getGridSize(8)).toBe(3);
  });

  it('returns 3 for 14 topics', () => {
    expect(getGridSize(14)).toBe(3);
  });

  it('returns 4 for 15 topics', () => {
    expect(getGridSize(15)).toBe(4);
  });

  it('returns 4 for 23 topics', () => {
    expect(getGridSize(23)).toBe(4);
  });

  it('returns 5 for 24 topics', () => {
    expect(getGridSize(24)).toBe(5);
  });

  it('returns 5 for 100 topics', () => {
    expect(getGridSize(100)).toBe(5);
  });

  it('returns 3 (minimum) for fewer than 8 topics', () => {
    expect(getGridSize(5)).toBe(3);
  });
});

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).toHaveLength(5);
  });

  it('contains all original elements', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffle(input);
    expect(result.sort()).toEqual(input.sort());
  });

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it('produces different orderings (statistical)', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const results = new Set();
    for (let i = 0; i < 10; i++) {
      results.add(shuffle(input).join(','));
    }
    // With 20 elements, getting the same order twice is astronomically unlikely
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('checkBingo', () => {
  // Helper: create cells for a grid
  function makeCells(gridSize, markedIndices) {
    const cells = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      cells.push({ cell_index: i, marked: markedIndices.includes(i) });
    }
    return cells;
  }

  describe('3x3 grid', () => {
    // Grid layout:
    // 0 1 2
    // 3 4 5
    // 6 7 8

    it('detects horizontal bingo (top row)', () => {
      const result = checkBingo(makeCells(3, [0, 1, 2]), 3);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([0, 1, 2]);
    });

    it('detects horizontal bingo (middle row)', () => {
      const result = checkBingo(makeCells(3, [3, 4, 5]), 3);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([3, 4, 5]);
    });

    it('detects horizontal bingo (bottom row)', () => {
      const result = checkBingo(makeCells(3, [6, 7, 8]), 3);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([6, 7, 8]);
    });

    it('detects vertical bingo (left column)', () => {
      const result = checkBingo(makeCells(3, [0, 3, 6]), 3);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([0, 3, 6]);
    });

    it('detects vertical bingo (center column)', () => {
      const result = checkBingo(makeCells(3, [1, 4, 7]), 3);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([1, 4, 7]);
    });

    it('detects diagonal bingo (top-left to bottom-right)', () => {
      const result = checkBingo(makeCells(3, [0, 4, 8]), 3);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([0, 4, 8]);
    });

    it('detects diagonal bingo (top-right to bottom-left)', () => {
      const result = checkBingo(makeCells(3, [2, 4, 6]), 3);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([2, 4, 6]);
    });

    it('returns no bingo for incomplete line', () => {
      const result = checkBingo(makeCells(3, [0, 1, 4]), 3);
      expect(result.bingo).toBe(false);
      expect(result.winningLine).toBeNull();
    });

    it('returns no bingo for empty board', () => {
      const result = checkBingo(makeCells(3, []), 3);
      expect(result.bingo).toBe(false);
    });

    it('returns first winning line when multiple exist', () => {
      // Both top row and left column
      const result = checkBingo(makeCells(3, [0, 1, 2, 3, 6]), 3);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([0, 1, 2]); // rows checked first
    });
  });

  describe('5x5 grid', () => {
    // Grid layout:
    //  0  1  2  3  4
    //  5  6  7  8  9
    // 10 11 12 13 14
    // 15 16 17 18 19
    // 20 21 22 23 24

    it('detects horizontal bingo', () => {
      const result = checkBingo(makeCells(5, [10, 11, 12, 13, 14]), 5);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([10, 11, 12, 13, 14]);
    });

    it('detects vertical bingo', () => {
      const result = checkBingo(makeCells(5, [2, 7, 12, 17, 22]), 5);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([2, 7, 12, 17, 22]);
    });

    it('detects main diagonal', () => {
      const result = checkBingo(makeCells(5, [0, 6, 12, 18, 24]), 5);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([0, 6, 12, 18, 24]);
    });

    it('detects anti-diagonal', () => {
      const result = checkBingo(makeCells(5, [4, 8, 12, 16, 20]), 5);
      expect(result.bingo).toBe(true);
      expect(result.winningLine).toEqual([4, 8, 12, 16, 20]);
    });

    it('returns no bingo with 4 of 5 in a row', () => {
      const result = checkBingo(makeCells(5, [0, 1, 2, 3]), 5);
      expect(result.bingo).toBe(false);
    });
  });
});
