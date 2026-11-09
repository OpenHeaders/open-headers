/**
 * Linear fragments of the log graph — the reference's hover and collapse
 * unit. A fragment is the run of plain commits (one parent, one child in
 * the window, no ref) between two anchors: a fork, a merge, a commit a
 * ref points at, HEAD's commit, or the window's edge. Hovering a node
 * lights the fragment it sits in; a click hides the fragment's interior
 * rows and leaves the two ends, a stub on each pointing at the hidden
 * run; a second click brings the rows back. The graph gear's Collapse
 * Linear Branches names every fragment of the window at once and Expand
 * clears them. Pure: the view hands the entries in log order (newest
 * first) and keeps the collapsed map, keyed by {@link fragmentKey} — the
 * top end and the first hidden commit, so two runs under one merge
 * stay apart.
 */

import { edgeKey } from './graph';

export interface FragmentEntry {
  sha: string;
  parents: readonly string[];
}

/** One linear run: its two end commits and the plain commits between them, in log order. */
export interface LogFragment {
  top: string;
  bottom: string;
  interior: readonly string[];
}

interface LogIndex<T extends FragmentEntry> {
  bySha: ReadonlyMap<string, T>;
  childrenOf: ReadonlyMap<string, readonly string[]>;
}

function indexWindow<T extends FragmentEntry>(entries: readonly T[]): LogIndex<T> {
  const bySha = new Map<string, T>();
  const childrenOf = new Map<string, string[]>();
  for (const entry of entries) {
    bySha.set(entry.sha, entry);
    for (const parent of entry.parents) {
      const list = childrenOf.get(parent);
      if (list !== undefined) list.push(entry.sha);
      else childrenOf.set(parent, [entry.sha]);
    }
  }
  return { bySha, childrenOf };
}

/** A plain commit: one parent, one child inside the window, no anchor on it. */
function isPlain<T extends FragmentEntry>(log: LogIndex<T>, anchors: ReadonlySet<string>, sha: string): boolean {
  const entry = log.bySha.get(sha);
  if (entry === undefined || anchors.has(sha)) return false;
  return entry.parents.length === 1 && (log.childrenOf.get(sha)?.length ?? 0) === 1;
}

/** Walk first parents down from `start` over plain commits; answers the run and the commit it stopped on. */
function walkDown<T extends FragmentEntry>(
  log: LogIndex<T>,
  anchors: ReadonlySet<string>,
  start: string,
): { run: string[]; stop: string | null } {
  const run: string[] = [];
  let cursor: string | null = start;
  while (cursor !== null && isPlain(log, anchors, cursor)) {
    run.push(cursor);
    const parent: string = log.bySha.get(cursor)?.parents[0] ?? '';
    cursor = log.bySha.has(parent) ? parent : null;
  }
  return { run, stop: cursor };
}

function fragmentOf<T extends FragmentEntry>(
  log: LogIndex<T>,
  anchors: ReadonlySet<string>,
  sha: string,
): LogFragment | null {
  if (!log.bySha.has(sha)) return null;
  let top = sha;
  let first = sha;
  if (isPlain(log, anchors, sha)) {
    // Up: a plain commit has exactly one child, so the walk ends on an
    // anchor — `first` is the run's newest plain commit, just under it.
    let cursor = sha;
    while (isPlain(log, anchors, cursor)) {
      first = cursor;
      cursor = log.childrenOf.get(cursor)?.[0] ?? cursor;
    }
    top = cursor;
  } else {
    const parent = log.bySha.get(sha)?.parents[0];
    if (parent === undefined || !isPlain(log, anchors, parent)) return null;
    first = parent;
  }
  const { run, stop } = walkDown(log, anchors, first);
  if (run.length === 0) return null;
  // The window's edge: the run's last commit becomes the bottom end.
  if (stop === null) {
    const bottom = run.pop();
    if (bottom === undefined || run.length === 0) return null;
    return { top, bottom, interior: run };
  }
  return { top, bottom: stop, interior: run };
}

/**
 * The fragment `sha` sits in: a plain commit widens both ways to the
 * nearest anchors; an anchor reads the run below it along its first
 * parent. Null when the run has no plain commit to hide.
 */
export function linearFragment<T extends FragmentEntry>(
  entries: readonly T[],
  sha: string,
  anchors: ReadonlySet<string>,
): LogFragment | null {
  return fragmentOf(indexWindow(entries), anchors, sha);
}

/** The key the collapsed map holds a fragment under — its top end and the first commit it hides. */
export function fragmentKey(fragment: LogFragment): string {
  return edgeKey(fragment.top, fragment.interior[0]);
}

/** Every fragment of the window, each once, in the order their commits appear (Collapse Linear Branches). */
export function allLinearFragments<T extends FragmentEntry>(
  entries: readonly T[],
  anchors: ReadonlySet<string>,
): LogFragment[] {
  const log = indexWindow(entries);
  const seen = new Set<string>();
  const fragments: LogFragment[] = [];
  for (const entry of entries) {
    const fragment = fragmentOf(log, anchors, entry.sha);
    if (fragment === null) continue;
    const key = fragmentKey(fragment);
    if (seen.has(key)) continue;
    seen.add(key);
    fragments.push(fragment);
  }
  return fragments;
}

/** The fragment a hover resolves to: a collapsed fragment first (either end re-expands it), else the linear run. */
export function hoverFragment<T extends FragmentEntry>(
  entries: readonly T[],
  sha: string,
  anchors: ReadonlySet<string>,
  collapsed: ReadonlyMap<string, LogFragment>,
): LogFragment | null {
  for (const fragment of collapsed.values()) {
    if (fragment.top === sha || fragment.bottom === sha) return fragment;
  }
  return linearFragment(entries, sha, anchors);
}

/** Every commit the fragment lights — the ends and the interior. */
export function fragmentShas(fragment: LogFragment): ReadonlySet<string> {
  return new Set([fragment.top, ...fragment.interior, fragment.bottom]);
}

/** The edges the fragment lights: the pairs down the run, and the skipping edge a collapse draws in their place. */
export function fragmentEdges(fragment: LogFragment): ReadonlySet<string> {
  const chain = [fragment.top, ...fragment.interior, fragment.bottom];
  const keys = new Set<string>();
  for (let i = 1; i < chain.length; i += 1) keys.add(edgeKey(chain[i - 1], chain[i]));
  keys.add(edgeKey(fragment.top, fragment.bottom));
  return keys;
}

/**
 * The log with every collapsed fragment's interior hidden: the top end's
 * parent pointer into the run skips to the bottom end and the skipping
 * edge is named so the layout can draw it as the stubs. A fragment whose
 * ends are no longer both in the window is ignored.
 */
export function collapseLog<T extends FragmentEntry>(
  entries: readonly T[],
  collapsed: ReadonlyMap<string, LogFragment>,
): { entries: T[]; collapsedEdges: ReadonlySet<string> } {
  if (collapsed.size === 0) return { entries: [...entries], collapsedEdges: new Set() };
  const present = new Set(entries.map((entry) => entry.sha));
  const hidden = new Set<string>();
  // The parent pointer each collapse rewires (by its edge key) and the bottom end it now reaches.
  const skipTo = new Map<string, string>();
  const collapsedEdges = new Set<string>();
  for (const fragment of collapsed.values()) {
    if (!present.has(fragment.top) || !present.has(fragment.bottom) || fragment.interior.length === 0) continue;
    for (const sha of fragment.interior) hidden.add(sha);
    skipTo.set(fragmentKey(fragment), fragment.bottom);
    collapsedEdges.add(edgeKey(fragment.top, fragment.bottom));
  }
  const visible = entries.flatMap((entry) => {
    if (hidden.has(entry.sha)) return [];
    const parents = entry.parents.map((parent) => skipTo.get(edgeKey(entry.sha, parent)) ?? parent);
    return [parents.every((parent, i) => parent === entry.parents[i]) ? entry : { ...entry, parents }];
  });
  return { entries: visible, collapsedEdges };
}
