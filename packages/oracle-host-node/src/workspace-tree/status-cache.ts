/**
 * Movement-invalidated snapshot of an expensive async read — the §9
 * status feed's authority discipline: ONE writer invalidates when the
 * world moves; any number of readers share a single in-flight compute
 * and then snapshot the cached frame for free.
 *
 * Without this, status is pull-computed per reader: every surface that
 * mounts (card, tool window, settings mirror) pays its own porcelain
 * spawn cluster, and a boot burst multiplies them. With it, a burst of
 * invalidations costs exactly one recompute at the next read.
 *
 * Invalidation during an in-flight compute DETACHES it: its awaiters
 * still get their answer (they asked before the movement), but the
 * pre-movement result never seeds the cache — the next reader
 * recomputes against post-movement state.
 */
export class StatusCache<T> {
  private snapshot: T | null = null;
  private inFlight: Promise<T> | null = null;
  private epoch = 0;

  /** The world moved — the snapshot no longer describes it. */
  invalidate(): void {
    this.epoch += 1;
    this.snapshot = null;
    this.inFlight = null;
  }

  /** Cached frame when fresh, else one shared compute; never more than one in flight. */
  read(compute: () => Promise<T>): Promise<T> {
    if (this.snapshot !== null) return Promise.resolve(this.snapshot);
    if (this.inFlight === null) {
      const epoch = this.epoch;
      this.inFlight = compute().then(
        (value) => {
          if (epoch === this.epoch) {
            this.snapshot = value;
            this.inFlight = null;
          }
          return value;
        },
        (err: unknown) => {
          if (epoch === this.epoch) this.inFlight = null;
          throw err;
        },
      );
    }
    return this.inFlight;
  }
}
