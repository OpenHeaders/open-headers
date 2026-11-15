/**
 * The log models' pins are written with named commits: a short list is
 * numbered on the way in and what a model answers is read back by name.
 */

import { type DerivedLog, type NamedLogEntry, numberLog } from '../../src/workspace-tree';

export const commit = (sha: string, ...parents: string[]): NamedLogEntry => ({ sha, parents });

export function named(entries: readonly NamedLogEntry[]) {
  const { skeleton, shas, numberOf } = numberLog(entries);
  const row = (sha: string): number => numberOf.get(sha) ?? -1;
  return {
    skeleton,
    row,
    /** A flag per row, set on the rows named; a name the list does not hold sets none. */
    flags: (...names: string[]): Uint8Array => {
      const flags = new Uint8Array(skeleton.count);
      for (const name of names) {
        if (row(name) >= 0 && row(name) < skeleton.count) flags[row(name)] = 1;
      }
      return flags;
    },
    /** The rows a flag is set on, or the rows given, by name. */
    names: (rows: Uint8Array | Int32Array): string[] =>
      rows instanceof Uint8Array
        ? shas.slice(0, skeleton.count).filter((_, at) => rows[at] === 1)
        : [...rows].map((at) => shas[at]),
    /** A list made out of this one, by name: each commit with what it points at, and the pointers that pass over hidden commits. */
    read: (derived: DerivedLog): { entries: NamedLogEntry[]; skipped: string[] } => {
      const nameOf = (at: number): string => (at < derived.skeleton.count ? shas[derived.rows[at]] : 'outside');
      const out: NamedLogEntry[] = [];
      const skipped: string[] = [];
      for (let at = 0; at < derived.skeleton.count; at += 1) {
        const parents: string[] = [];
        for (let pointer = derived.skeleton.starts[at]; pointer < derived.skeleton.starts[at + 1]; pointer += 1) {
          parents.push(nameOf(derived.skeleton.parents[pointer]));
          if (derived.skeleton.skips?.[pointer] === 1) {
            skipped.push(`${nameOf(at)}>${nameOf(derived.skeleton.parents[pointer])}`);
          }
        }
        out.push({ sha: nameOf(at), parents });
      }
      return { entries: out, skipped };
    },
  };
}
