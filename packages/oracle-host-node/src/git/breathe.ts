/**
 * Hands the host's thread back for a turn — a long pass over a whole
 * history is taken a stretch at a time, with every other piece of the
 * host's work let in between two stretches.
 */
export function breathe(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
