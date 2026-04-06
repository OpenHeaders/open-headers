/**
 * Tests for tab reorder logic.
 *
 * Extracts the pure reorder algorithm and tests all cases:
 * - Drag to left/right side of adjacent and non-adjacent tabs
 * - No-op when already in place
 * - Dragging to edges (first/last)
 */

import { describe, expect, it } from 'vitest';

/** Pure reorder function extracted from useTabs */
function reorderTabs(tabIds: string[], fromId: string, toId: string, side: 'left' | 'right'): string[] {
  const tabs = [...tabIds];
  const from = tabs.indexOf(fromId);
  const to = tabs.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return tabIds;

  const target = side === 'right' ? to + 1 : to;
  // Already in the right spot — no-op
  if (target === from || target === from + 1) return tabIds;

  const [moved] = tabs.splice(from, 1);
  const insertAt = target > from ? target - 1 : target;
  tabs.splice(insertAt, 0, moved);
  return tabs;
}

describe('reorderTabs', () => {
  // [A, B, C] — 3 tabs

  describe('dragging to the right (forward)', () => {
    it('drag A to right side of B → [B, A, C]', () => {
      expect(reorderTabs(['A', 'B', 'C'], 'A', 'B', 'right')).toEqual(['B', 'A', 'C']);
    });

    it('drag A to right side of C → [B, C, A]', () => {
      expect(reorderTabs(['A', 'B', 'C'], 'A', 'C', 'right')).toEqual(['B', 'C', 'A']);
    });

    it('drag B to right side of C → [A, C, B]', () => {
      expect(reorderTabs(['A', 'B', 'C'], 'B', 'C', 'right')).toEqual(['A', 'C', 'B']);
    });
  });

  describe('dragging to the left (backward)', () => {
    it('drag C to left side of B → [A, C, B]', () => {
      expect(reorderTabs(['A', 'B', 'C'], 'C', 'B', 'left')).toEqual(['A', 'C', 'B']);
    });

    it('drag C to left side of A → [C, A, B]', () => {
      expect(reorderTabs(['A', 'B', 'C'], 'C', 'A', 'left')).toEqual(['C', 'A', 'B']);
    });

    it('drag B to left side of A → [B, A, C]', () => {
      expect(reorderTabs(['A', 'B', 'C'], 'B', 'A', 'left')).toEqual(['B', 'A', 'C']);
    });
  });

  describe('no-op when already in place', () => {
    it('drag A to left side of B (A is already left of B) → no change', () => {
      const original = ['A', 'B', 'C'];
      expect(reorderTabs(original, 'A', 'B', 'left')).toBe(original);
    });

    it('drag B to right side of A (B is already right of A) → no change', () => {
      const original = ['A', 'B', 'C'];
      expect(reorderTabs(original, 'B', 'A', 'right')).toBe(original);
    });

    it('drag C to right side of B (C is already right of B) → no change', () => {
      const original = ['A', 'B', 'C'];
      expect(reorderTabs(original, 'C', 'B', 'right')).toBe(original);
    });

    it('drag B to left side of C (B is already left of C) → no change', () => {
      const original = ['A', 'B', 'C'];
      expect(reorderTabs(original, 'B', 'C', 'left')).toBe(original);
    });
  });

  describe('4 tabs [A, B, C, D]', () => {
    it('drag B to right side of C → [A, C, B, D]', () => {
      expect(reorderTabs(['A', 'B', 'C', 'D'], 'B', 'C', 'right')).toEqual(['A', 'C', 'B', 'D']);
    });

    it('drag C to left side of B → [A, C, B, D]', () => {
      expect(reorderTabs(['A', 'B', 'C', 'D'], 'C', 'B', 'left')).toEqual(['A', 'C', 'B', 'D']);
    });

    it('drag D to left side of A → [D, A, B, C]', () => {
      expect(reorderTabs(['A', 'B', 'C', 'D'], 'D', 'A', 'left')).toEqual(['D', 'A', 'B', 'C']);
    });

    it('drag A to right side of D → [B, C, D, A]', () => {
      expect(reorderTabs(['A', 'B', 'C', 'D'], 'A', 'D', 'right')).toEqual(['B', 'C', 'D', 'A']);
    });
  });
});
