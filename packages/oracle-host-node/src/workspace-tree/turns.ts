/**
 * Whose turn a read of a workspace's history has — the bound on how
 * many reads of one kind run at once. A surface names itself by a key
 * (a log tab): its newer read ends its older one, which nobody reads
 * any more; and a workspace runs at most `maxPerOwner` at a time, the
 * oldest giving way — so no caller, by keys of its own making, can pile
 * work up on the host.
 *
 * One set of turns per kind of read (a search, a page of rows): a tab's
 * rows never end its search.
 *
 * Pure bookkeeping over abort signals; the read that holds a turn ends
 * when its signal does.
 */

export interface Turn {
  /** Aborted when the turn is taken away — by the same key's newer read, or by the bound. */
  signal: AbortSignal;
  /** The read is over: its turn is free. */
  done(): void;
}

export interface Turns {
  take(owner: string, key: string): Turn;
  /** Ends every read in flight — the host is going away. */
  endAll(): void;
}

export function createTurns(maxPerOwner: number): Turns {
  // A map keeps the order turns were taken in: its first entry is the oldest.
  const owners = new Map<string, Map<string, AbortController>>();

  return {
    take(owner, key) {
      const turns = owners.get(owner) ?? new Map<string, AbortController>();
      owners.set(owner, turns);
      turns.get(key)?.abort();
      turns.delete(key);
      const controller = new AbortController();
      turns.set(key, controller);
      for (const [oldest, held] of turns) {
        if (turns.size <= maxPerOwner) break;
        held.abort();
        turns.delete(oldest);
      }
      return {
        signal: controller.signal,
        done: () => {
          if (turns.get(key) === controller) turns.delete(key);
          if (turns.size === 0 && owners.get(owner) === turns) owners.delete(owner);
        },
      };
    },
    endAll() {
      for (const turns of owners.values()) {
        for (const held of turns.values()) held.abort();
      }
      owners.clear();
    },
  };
}
