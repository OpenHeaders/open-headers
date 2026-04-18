/**
 * LogRing — fixed-capacity FIFO ring buffer for observability entries.
 *
 * Pure data structure, no I/O, no subscriptions — the SW-side owner
 * (`background/modules/observability-log.ts`) wraps it with
 * persistence + broadcast.
 *
 * Capacity default N=500 matches ARCHITECTURE.md §26; oldest entries
 * fall off the front when the buffer overflows.
 */

import type { LogEntry } from './types';

export const DEFAULT_CAPACITY = 500;

export class LogRing {
  private readonly capacity: number;
  private entries: LogEntry[] = [];

  constructor(capacity: number = DEFAULT_CAPACITY) {
    if (capacity <= 0) throw new Error(`LogRing capacity must be positive, got ${capacity}`);
    this.capacity = capacity;
  }

  /** Append one entry; drops the oldest if the buffer is at capacity. */
  record(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      // Trim from the front. Slice creates a new array each time the
      // buffer is full; at N=500 that's cheap and keeps the read path
      // simple (a flat array beats a circular pointer for UI display).
      this.entries = this.entries.slice(this.entries.length - this.capacity);
    }
  }

  /** Read-only view of the current entries, oldest first. */
  getAll(): readonly LogEntry[] {
    return this.entries;
  }

  /** Current entry count. `<= capacity`. */
  size(): number {
    return this.entries.length;
  }

  /** Drop every entry. Does not reset capacity. */
  clear(): void {
    this.entries = [];
  }

  /**
   * Replace the buffer with a persisted snapshot. Oversize snapshots
   * are silently truncated to the most recent `capacity` entries —
   * tolerates capacity shrinks (e.g. if we ever make this configurable
   * and a user lowers N).
   */
  hydrate(snapshot: readonly LogEntry[]): void {
    if (snapshot.length <= this.capacity) {
      this.entries = [...snapshot];
    } else {
      this.entries = snapshot.slice(snapshot.length - this.capacity);
    }
  }

  /** Fresh copy for persistence. */
  snapshot(): LogEntry[] {
    return [...this.entries];
  }
}
