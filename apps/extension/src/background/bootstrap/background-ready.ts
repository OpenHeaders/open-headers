let ready = false;
let resolveBarrier: () => void = () => {};

export const backgroundReady: Promise<void> = new Promise((resolve) => {
  resolveBarrier = resolve;
});

export function resolveBackgroundReady(): void {
  ready = true;
  resolveBarrier();
}

/**
 * Synchronous read of the barrier — true once `initializeExtension` has
 * hydrated stores and booted the sync engine (or failed terminally, in
 * which case answering reads beats stalling them forever). Feeds the
 * oracle's `isSnapshotPlaneReady` host hook so mirror-bootstrap RPCs
 * arriving mid-boot get an explicit not-ready answer to retry on.
 */
export function isBackgroundReady(): boolean {
  return ready;
}
