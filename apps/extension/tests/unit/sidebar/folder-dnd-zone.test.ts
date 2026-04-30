/**
 * Unit tests for `classifyDropZone` — the pointer-Y → drop-zone band
 * classifier the FolderDndTree gesture surface uses.
 */

import { describe, expect, it } from 'vitest';
import { classifyDropZone } from '@/workbench/components/sidebar/folder-dnd-zone';

const rect = { top: 100, height: 40 }; // bands: 100–110 'before', 110–130 'into', 130–140 'after'

describe('classifyDropZone', () => {
  it('returns before above the top band threshold', () => {
    expect(classifyDropZone(101, rect)).toBe('before');
    expect(classifyDropZone(109.999, rect)).toBe('before');
  });

  it('returns into within the middle band', () => {
    expect(classifyDropZone(110, rect)).toBe('into');
    expect(classifyDropZone(120, rect)).toBe('into');
    expect(classifyDropZone(129.999, rect)).toBe('into');
  });

  it('returns after below the bottom band threshold', () => {
    expect(classifyDropZone(130.0001, rect)).toBe('after');
    expect(classifyDropZone(139, rect)).toBe('after');
  });

  it('honours a custom threshold', () => {
    // 50% threshold collapses 'into' to a zero-width band at the
    // midpoint; everything else splits into halves.
    expect(classifyDropZone(110, rect, 0.5)).toBe('before');
    expect(classifyDropZone(120, rect, 0.5)).toBe('into');
    expect(classifyDropZone(130, rect, 0.5)).toBe('after');
  });

  it('coerces zero-height rects to into', () => {
    expect(classifyDropZone(100, { top: 100, height: 0 })).toBe('into');
  });

  it('classifies the boundaries deterministically', () => {
    // offset == beforeBoundary (10) is exactly at boundary — not <, so 'into'.
    expect(classifyDropZone(110, rect)).toBe('into');
    // offset == afterBoundary (30) is exactly at boundary — not >, so 'into'.
    expect(classifyDropZone(130, rect)).toBe('into');
  });
});
