/**
 * `useRecordingWindows` + `isRecorded` — the record/stop button modeled as
 * recording intervals. Asserts browser-parity: requests that start while
 * recording is stopped fall in a gap and are dropped, and resuming opens a
 * fresh window rather than back-filling.
 */

import { isRecorded, useRecordingWindows } from '@openheaders/ui/panel/data/use-recording-windows';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('isRecorded', () => {
  it('is true inside an open or closed window, false in the gap', () => {
    const windows = [
      { startMs: 0, endMs: 100 },
      { startMs: 200, endMs: null },
    ];
    expect(isRecorded(50, windows)).toBe(true); // inside the closed window
    expect(isRecorded(100, windows)).toBe(false); // end is exclusive → gap
    expect(isRecorded(150, windows)).toBe(false); // paused gap
    expect(isRecorded(200, windows)).toBe(true); // start is inclusive
    expect(isRecorded(999, windows)).toBe(true); // open window
  });

  it('is false when there are no windows (recording never started)', () => {
    expect(isRecorded(123, [])).toBe(false);
  });
});

describe('useRecordingWindows', () => {
  it('opens a window at 0 when recording starts on', () => {
    const { result } = renderHook(() => useRecordingWindows(true));
    expect(result.current).toEqual([{ startMs: 0, endMs: null }]);
  });

  it('starts empty when recording is off', () => {
    const { result } = renderHook(() => useRecordingWindows(false));
    expect(result.current).toEqual([]);
  });

  it('closes the open window on stop and opens a fresh one on resume', () => {
    let t = 0;
    const now = () => t;
    const { result, rerender } = renderHook(({ rec }) => useRecordingWindows(rec, now), {
      initialProps: { rec: true },
    });
    expect(result.current).toEqual([{ startMs: 0, endMs: null }]);

    // Stop at 1000 → close the open window.
    t = 1000;
    rerender({ rec: false });
    expect(result.current).toEqual([{ startMs: 0, endMs: 1000 }]);

    // Resume at 2000 → open a fresh window; the [1000, 2000) gap is unrecorded.
    t = 2000;
    rerender({ rec: true });
    expect(result.current).toEqual([
      { startMs: 0, endMs: 1000 },
      { startMs: 2000, endMs: null },
    ]);
    expect(isRecorded(1500, result.current)).toBe(false); // dropped (paused)
    expect(isRecorded(2500, result.current)).toBe(true); // kept (after resume)
  });
});
