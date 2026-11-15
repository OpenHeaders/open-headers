/**
 * A log's skeleton — its commits as ROWS BY NUMBER, in the order they
 * are listed (newest first, no parent above its child), each with the
 * rows its parents sit on. What every model of the log reads: a whole
 * history is a few bytes a commit this way, where a hash string and an
 * object a commit are hundreds.
 *
 * A parent's number at or past `count` names a commit the list does not
 * hold — each one its own number, so two lines that leave the list for
 * different commits never read as one.
 */

export interface LogSkeleton {
  /** The rows the list holds. */
  count: number;
  /** Row `i`'s parents are `parents[starts[i] .. starts[i + 1])`, first parent first; `count + 1` entries. */
  starts: Int32Array;
  parents: Int32Array;
  /**
   * Beside `parents`, pointer for pointer: 1 where the pointer passes
   * over commits the list hides (a folded run, a sifted list) — the
   * graph draws it as stubs, not a line. Absent when none does.
   */
  skips?: Uint8Array;
}

/** A list made out of another: its own skeleton, and the source's row behind each of its rows. */
export interface DerivedLog {
  skeleton: LogSkeleton;
  rows: Int32Array;
}

/**
 * The rows named, in the order named, as a list of their own — a scope's
 * commits out of a whole history, a history re-listed in another order.
 * A parent that is not among them is outside the new list.
 */
export function pickRows(source: LogSkeleton, rows: Int32Array): DerivedLog {
  const placed = new Int32Array(source.count).fill(-1);
  for (let row = 0; row < rows.length; row += 1) placed[rows[row]] = row;
  const outside = new Map<number, number>();
  const starts = new Int32Array(rows.length + 1);
  const parents: number[] = [];
  const skips: number[] = [];
  for (let row = 0; row < rows.length; row += 1) {
    starts[row] = parents.length;
    for (let pointer = source.starts[rows[row]]; pointer < source.starts[rows[row] + 1]; pointer += 1) {
      const parent = source.parents[pointer];
      let number = parent < source.count ? placed[parent] : -1;
      if (number === -1) {
        number = outside.get(parent) ?? rows.length + outside.size;
        outside.set(parent, number);
      }
      parents.push(number);
      skips.push(source.skips === undefined ? 0 : source.skips[pointer]);
    }
  }
  starts[rows.length] = parents.length;
  const skeleton: LogSkeleton = { count: rows.length, starts, parents: Int32Array.from(parents) };
  if (source.skips !== undefined) skeleton.skips = Uint8Array.from(skips);
  return { skeleton, rows };
}

/** The list as a first-parent walk draws it: every commit joined to its first parent alone. */
export function firstParentOnly(source: LogSkeleton): LogSkeleton {
  const starts = new Int32Array(source.count + 1);
  const parents: number[] = [];
  const skips: number[] = [];
  for (let row = 0; row < source.count; row += 1) {
    starts[row] = parents.length;
    const first = source.starts[row];
    if (source.starts[row + 1] === first) continue;
    parents.push(source.parents[first]);
    skips.push(source.skips === undefined ? 0 : source.skips[first]);
  }
  starts[source.count] = parents.length;
  const skeleton: LogSkeleton = { count: source.count, starts, parents: Int32Array.from(parents) };
  if (source.skips !== undefined) skeleton.skips = Uint8Array.from(skips);
  return skeleton;
}

export interface NamedLogEntry {
  sha: string;
  parents: readonly string[];
}

export interface NumberedLog {
  skeleton: LogSkeleton;
  /** The commit behind each number: the list's rows in order, then the commits outside it. */
  shas: string[];
  numberOf: ReadonlyMap<string, number>;
}

/** A short list of named commits as a skeleton — a parent outside the list is numbered past its end. */
export function numberLog(entries: readonly NamedLogEntry[]): NumberedLog {
  const shas = entries.map((entry) => entry.sha);
  const numberOf = new Map<string, number>();
  for (let row = 0; row < shas.length; row += 1) numberOf.set(shas[row], row);
  const starts = new Int32Array(entries.length + 1);
  const parents: number[] = [];
  for (let row = 0; row < entries.length; row += 1) {
    starts[row] = parents.length;
    for (const parent of entries[row].parents) {
      let number = numberOf.get(parent);
      if (number === undefined) {
        number = shas.length;
        shas.push(parent);
        numberOf.set(parent, number);
      }
      parents.push(number);
    }
  }
  starts[entries.length] = parents.length;
  return { skeleton: { count: entries.length, starts, parents: Int32Array.from(parents) }, shas, numberOf };
}
