import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useGridResize } from '@openheaders/ui/shared/merge-editor/monaco/use-grid-resize';

function setup(onResize?: () => void) {
  return renderHook(() => {
    const containerRef = useRef<HTMLDivElement>(null);
    return useGridResize({ containerRef, onResize });
  });
}

describe('useGridResize', () => {
  it('initializes with even col fractions and 35/65 row split', () => {
    const { result } = setup();
    expect(result.current.ratios.cols).toEqual([1, 1, 1]);
    expect(result.current.ratios.rows).toEqual([0.35, 0.65]);
  });

  it('nudgeColSash(0, "right") shifts mass from cols[1] into cols[0]', () => {
    const { result } = setup();
    act(() => result.current.nudgeColSash(0, 'right', 0.1));
    expect(result.current.ratios.cols[0]).toBeCloseTo(1.1);
    expect(result.current.ratios.cols[1]).toBeCloseTo(0.9);
    expect(result.current.ratios.cols[2]).toBe(1);
  });

  it('nudgeColSash(1, "left") shifts mass from cols[1] into cols[2]', () => {
    const { result } = setup();
    act(() => result.current.nudgeColSash(1, 'left', 0.1));
    expect(result.current.ratios.cols[0]).toBe(1);
    expect(result.current.ratios.cols[1]).toBeCloseTo(0.9);
    expect(result.current.ratios.cols[2]).toBeCloseTo(1.1);
  });

  it('nudgeRowSash("down") grows the top row, shrinks the bottom', () => {
    const { result } = setup();
    act(() => result.current.nudgeRowSash('down', 0.1));
    expect(result.current.ratios.rows[0]).toBeCloseTo(0.45);
    expect(result.current.ratios.rows[1]).toBeCloseTo(0.55);
  });

  it('nudgeRowSash("up") shrinks the top row', () => {
    const { result } = setup();
    act(() => result.current.nudgeRowSash('up', 0.1));
    expect(result.current.ratios.rows[0]).toBeCloseTo(0.25);
    expect(result.current.ratios.rows[1]).toBeCloseTo(0.75);
  });

  it('clamps col fractions at MIN_FRAC (0.08)', () => {
    const { result } = setup();
    // Try to drag cols[1] all the way to nothing.
    act(() => result.current.nudgeColSash(0, 'right', 5));
    expect(result.current.ratios.cols[1]).toBeGreaterThanOrEqual(0.08);
  });

  it('clamps row fractions at MIN_FRAC', () => {
    const { result } = setup();
    act(() => result.current.nudgeRowSash('up', 5));
    expect(result.current.ratios.rows[0]).toBeGreaterThanOrEqual(0.08);
  });

  it('keeps col-row sum invariants (cols sum to 3, rows sum to 1)', () => {
    const { result } = setup();
    act(() => result.current.nudgeColSash(0, 'right', 0.1));
    const colSum = result.current.ratios.cols.reduce((a, b) => a + b, 0);
    expect(colSum).toBeCloseTo(3);
    act(() => result.current.nudgeRowSash('down', 0.15));
    const rowSum = result.current.ratios.rows.reduce((a, b) => a + b, 0);
    expect(rowSum).toBeCloseTo(1);
  });

  it('reset() restores defaults after edits', () => {
    const { result } = setup();
    act(() => {
      result.current.nudgeColSash(0, 'right', 0.2);
      result.current.nudgeRowSash('down', 0.2);
    });
    expect(result.current.ratios.cols[0]).not.toBeCloseTo(1);
    act(() => result.current.reset());
    expect(result.current.ratios.cols).toEqual([1, 1, 1]);
    expect(result.current.ratios.rows).toEqual([0.35, 0.65]);
  });

  it('fires onResize on every nudge', () => {
    const onResize = vi.fn();
    const { result } = renderHook(() => {
      const containerRef = useRef<HTMLDivElement>(null);
      return useGridResize({ containerRef, onResize });
    });
    act(() => result.current.nudgeColSash(0, 'right', 0.05));
    expect(onResize).toHaveBeenCalledTimes(1);
    act(() => result.current.nudgeRowSash('down', 0.05));
    expect(onResize).toHaveBeenCalledTimes(2);
  });

  it('default step is 0.05 when caller omits step arg', () => {
    const { result } = setup();
    act(() => result.current.nudgeColSash(0, 'right'));
    expect(result.current.ratios.cols[0]).toBeCloseTo(1.05);
    expect(result.current.ratios.cols[1]).toBeCloseTo(0.95);
  });
});
