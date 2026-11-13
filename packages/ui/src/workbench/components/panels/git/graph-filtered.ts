/**
 * The log graph over a FILTERED list — the reference's reading of a
 * text search: the commits that stay are still drawn as a graph. Each
 * one is joined to the nearest listed commits it descends from; a join
 * that passes through hidden commits is named, so the view draws it as
 * the stubs a collapsed run wears and a line between two rows still
 * means "this is the parent".
 *
 * Pure. The window arrives in log order (newest first, no parent before
 * its child); a parent outside the window is unknown, so the line ends
 * there. A commit reached twice — by a listed parent and again through
 * a hidden path under another one — keeps the shorter story alone: a
 * join to a commit that another join already leads to is dropped.
 */

import { edgeKey } from './graph';

export interface FilteredLogEntry {
  sha: string;
  parents: readonly string[];
}

export interface ContractedLog {
  /** The listed commits in log order, each with the listed commits it is joined to. */
  entries: { sha: string; parents: string[] }[];
  /** The joins (by `edgeKey`) that pass through hidden commits. */
  skipped: Set<string>;
}

export function contractLog(window: readonly FilteredLogEntry[], listed: ReadonlySet<string>): ContractedLog {
  // Oldest first, so every parent is answered before the commits above it.
  const nearest = new Map<string, readonly string[]>();
  const joined = new Map<string, string[]>();
  const skipped = new Set<string>();

  /** `from` leads to `target` through the joins made so far. */
  const leadsTo = (from: string, target: string): boolean => {
    const seen = new Set<string>([from]);
    const stack = [from];
    for (let sha = stack.pop(); sha !== undefined; sha = stack.pop()) {
      if (sha === target) return true;
      for (const parent of joined.get(sha) ?? []) {
        if (!seen.has(parent)) {
          seen.add(parent);
          stack.push(parent);
        }
      }
    }
    return false;
  };

  for (let index = window.length - 1; index >= 0; index -= 1) {
    const entry = window[index];
    const reached: string[] = [];
    for (const parent of entry.parents) {
      for (const sha of nearest.get(parent) ?? []) {
        if (!reached.includes(sha)) reached.push(sha);
      }
    }
    if (!listed.has(entry.sha)) {
      nearest.set(entry.sha, reached);
      continue;
    }
    nearest.set(entry.sha, [entry.sha]);
    const kept = reached.filter((sha) => !reached.some((other) => other !== sha && leadsTo(other, sha)));
    joined.set(entry.sha, kept);
    for (const sha of kept) {
      if (!entry.parents.includes(sha)) skipped.add(edgeKey(entry.sha, sha));
    }
  }

  return {
    entries: window
      .filter((entry) => listed.has(entry.sha))
      .map((entry) => ({
        sha: entry.sha,
        parents: joined.get(entry.sha) ?? [],
      })),
    skipped,
  };
}
