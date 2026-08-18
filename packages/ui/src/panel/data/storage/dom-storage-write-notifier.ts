/**
 * Module-level write notifier for the DOM storage plane.
 *
 * The standard-plane DOM storage reads have no change events to ride
 * (see the storage-panel plan §2.1) — the grid polls. Open document
 * editors need faster catch-up for writes THIS panel makes (grid
 * inline edits, another entry document's save), so every write path
 * taps this notifier after the host write lands. Same discipline as
 * the host's invalidation pushes: the note carries no data, consumers
 * refetch through the read seam. Page-originated writes stay covered
 * by the editors' own poll.
 */

const listeners = new Set<() => void>();

export function notifyDomStorageWrite(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A listener crashing must not stop others.
    }
  }
}

export function subscribeDomStorageWrites(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
