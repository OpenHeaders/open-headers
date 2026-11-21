/**
 * Progressive mounting for a long list whose row heights are NOT known
 * (so it can't be windowed): mount a first batch, then one more batch
 * each time the end of the mounted rows comes near the viewport. The
 * work a list costs is then bounded by what the user scrolls to, not by
 * how long the list is.
 *
 * The caller renders `count` rows and, while `sentinelRef` is asked for
 * (`count < total`), an empty element carrying it after the last row.
 * A change of `resetKey` (a new list) starts over from the first batch.
 *
 * Without `IntersectionObserver` (jsdom) the whole list mounts, so
 * tests keep exercising every row.
 */

import { type RefObject, useEffect, useRef, useState } from 'react';

interface ProgressiveCountOptions {
  /** Rows per batch — enough to fill the scroll viewport with room to spare. */
  batch: number;
  /** How far past the viewport's bottom edge the next batch starts mounting, in pixels. */
  lookaheadPx: number;
  /** The scrolling ancestor the list lives in. */
  rootRef: RefObject<HTMLElement | null>;
}

export function useProgressiveCount<T extends HTMLElement>(
  total: number,
  resetKey: unknown,
  { batch, lookaheadPx, rootRef }: ProgressiveCountOptions,
): { count: number; sentinelRef: RefObject<T | null> } {
  const sentinelRef = useRef<T | null>(null);
  const [progress, setProgress] = useState({ key: resetKey, mounted: batch });
  if (progress.key !== resetKey) setProgress({ key: resetKey, mounted: batch });
  const mounted = progress.key === resetKey ? progress.mounted : batch;
  const count = Math.min(mounted, total);

  // Re-armed after every batch: an observer only reports CHANGES, and a
  // sentinel still in range after a batch landed would otherwise never
  // report again.
  useEffect(() => {
    if (count >= total) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const grow = (next: number): void =>
      setProgress((prev) => (prev.key === resetKey ? { key: resetKey, mounted: next } : prev));
    if (typeof IntersectionObserver === 'undefined') {
      grow(total);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) grow(count + batch);
      },
      { root: rootRef.current, rootMargin: `0px 0px ${lookaheadPx}px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [count, total, batch, lookaheadPx, resetKey, rootRef]);

  return { count, sentinelRef };
}
