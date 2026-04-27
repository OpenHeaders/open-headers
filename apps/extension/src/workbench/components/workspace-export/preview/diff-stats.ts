/**
 * Lightweight line-diff counts for the import-preview sidebar.
 *
 * Computes per-row `+added / -removed` against canonical YAML — the same
 * shape Monaco's DiffEditor will render in the right pane, so the
 * counts the user reads in the rail match what they see on click.
 *
 * Algorithm: split both sides by newlines, count lines unique to each
 * via a frequency map. A line that appears in target with multiplicity
 * 2 and incoming with multiplicity 1 counts as one "removed". This is
 * an approximation of Monaco's Hirschberg-style diff — good enough to
 * give the user a magnitude-of-change feel without the O(n·m) DP cost.
 *
 * Both sides empty → all zeros. One side empty → the other side's
 * line count goes wholesale into the corresponding bucket.
 */

export interface DiffLineCounts {
  added: number;
  removed: number;
}

const EMPTY: DiffLineCounts = { added: 0, removed: 0 };

export function diffLineCounts(targetYaml: string, incomingYaml: string): DiffLineCounts {
  if (targetYaml === incomingYaml) return EMPTY;

  const target = targetYaml ? targetYaml.split('\n') : [];
  const incoming = incomingYaml ? incomingYaml.split('\n') : [];
  if (target.length === 0 && incoming.length === 0) return EMPTY;
  if (target.length === 0) return { added: incoming.length, removed: 0 };
  if (incoming.length === 0) return { added: 0, removed: target.length };

  const targetFreq = new Map<string, number>();
  for (const line of target) targetFreq.set(line, (targetFreq.get(line) ?? 0) + 1);

  let added = 0;
  for (const line of incoming) {
    const remaining = targetFreq.get(line);
    if (remaining && remaining > 0) {
      targetFreq.set(line, remaining - 1);
    } else {
      added += 1;
    }
  }

  let removed = 0;
  for (const remaining of targetFreq.values()) removed += remaining;

  return { added, removed };
}
