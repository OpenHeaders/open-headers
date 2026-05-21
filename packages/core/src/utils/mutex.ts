/**
 * `createMutex` — a tail-promise serializer for non-atomic
 * read-modify-write cycles against host storage.
 *
 * A `get`-then-`set` pair on one storage slot is not atomic: two
 * overlapping calls each read the pre-mutation value, both compute
 * against it, and the one that writes last clobbers the other's change.
 * Funnelling every cycle through one mutex serializes them, so each call
 * reads what the previous one wrote.
 *
 * Each `createMutex()` returns an independent lock — one per storage
 * slot. A rejected operation does not break the chain (the next queued
 * op still runs); the rejection still surfaces to its own caller.
 *
 * This is NOT the tool for collapsing concurrent calls that all want the
 * *same* result onto one computation (idempotent-by-value first-boot
 * mint). That is in-flight-promise dedup — see `ensure-daemon-config.ts`,
 * which is deliberately kept separate: it returns one shared result to
 * every caller, where a mutex would serialize and re-run.
 */
export type Mutex = <T>(op: () => Promise<T>) => Promise<T>;

export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(op: () => Promise<T>): Promise<T> => {
    const run = tail.then(op, op);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
