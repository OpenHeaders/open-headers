/**
 * `useRecordingWindows` — the record/stop button as a set of "recording
 * on" intervals, so the panel can drop requests that started while
 * recording was stopped (browser-parity: a stopped recorder captures
 * nothing, and resuming does not back-fill the gap).
 *
 * Each toggle edits the interval list: stopping closes the open interval
 * at "now", starting opens a fresh one. A request is shown only if its
 * `startedAtMs` falls inside some interval — `isRecorded`. Recording
 * defaults on, so the first interval opens at 0 (every request qualifies)
 * until the user first stops.
 *
 * `now` is injectable for deterministic tests; production uses the wall
 * clock, which shares the same epoch as the engine's `startedAtMs`.
 */

import { useEffect, useRef, useState } from 'react';

export interface RecordingWindow {
  /** Inclusive start (epoch ms). */
  readonly startMs: number;
  /** Exclusive end (epoch ms), or null while still recording. */
  readonly endMs: number | null;
}

/** True when `startedAtMs` falls inside one of the recording windows. */
export function isRecorded(startedAtMs: number, windows: readonly RecordingWindow[]): boolean {
  for (const w of windows) {
    if (startedAtMs >= w.startMs && (w.endMs === null || startedAtMs < w.endMs)) return true;
  }
  return false;
}

export function useRecordingWindows(recording: boolean, now: () => number = Date.now): readonly RecordingWindow[] {
  const [windows, setWindows] = useState<readonly RecordingWindow[]>(() =>
    recording ? [{ startMs: 0, endMs: null }] : [],
  );
  const prevRef = useRef(recording);

  useEffect(() => {
    if (prevRef.current === recording) return;
    prevRef.current = recording;
    const t = now();
    setWindows((prev) =>
      recording
        ? [...prev, { startMs: t, endMs: null }]
        : prev.map((w) => (w.endMs === null ? { startMs: w.startMs, endMs: t } : w)),
    );
  }, [recording, now]);

  return windows;
}
