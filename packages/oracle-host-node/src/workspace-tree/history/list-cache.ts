/**
 * The lists a workspace keeps — a few, by the name of what was asked.
 * A list is made once and shared by everyone who asks the same,
 * meanwhile and afterwards; one more than the bound lets the list
 * longest unasked go. What could not be made is not kept.
 */

export interface ListCache<T> {
  /** The answer kept under `name`, or the one `make` starts now. `keeps` says whether an answer is worth keeping. */
  take(name: string, make: () => Promise<T>, keeps: (answer: T) => boolean): Promise<T>;
  /** Everything kept is let go — what it was made from is gone. */
  clear(): void;
}

export function createListCache<T>(max: number): ListCache<T> {
  // A map keeps the order names were last asked in: its first entry is the one longest unasked.
  const kept = new Map<string, Promise<T>>();

  return {
    take(name, make, keeps) {
      const held = kept.get(name);
      if (held !== undefined) {
        kept.delete(name);
        kept.set(name, held);
        return held;
      }
      const forget = (): void => {
        if (kept.get(name) === making) kept.delete(name);
      };
      const making: Promise<T> = make().then(
        (answer) => {
          if (!keeps(answer)) forget();
          return answer;
        },
        (fault: unknown) => {
          forget();
          throw fault;
        },
      );
      kept.set(name, making);
      for (const oldest of kept.keys()) {
        if (kept.size <= max) break;
        kept.delete(oldest);
      }
      return making;
    },
    clear() {
      kept.clear();
    },
  };
}
