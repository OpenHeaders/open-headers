/**
 * git-log-recent-filters — per workspace, the log's filters applied
 * last, newest first: what the Branch, User and Paths chips' Recent
 * rows list — and, for a path picked in the tree by what it belongs to,
 * the name it was picked under, which the chip, Recent and the tab read
 * in its place. Durable, like the rail's favorites — the shared
 * per-workspace prefs posture.
 */

import { RECENT_VALUES_MAX, withRecentValues } from './toolbar/filter-values';
import { createWorkspacePrefsStore } from './workspace-prefs-store';

export interface GitLogRecentFilters {
  /** Branch: the scopes applied — each the refs walked together. */
  scopes: readonly (readonly string[])[];
  /** User: the author lists applied. */
  users: readonly (readonly string[])[];
  /** Paths: the path lists applied. */
  paths: readonly (readonly string[])[];
  /** By path: the name a path was picked under in the tree (an entity's, a collection's). */
  pathNames: Readonly<Record<string, string>>;
}

export type GitLogRecentKind = 'scopes' | 'users' | 'paths';

function isValues(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.length > 0);
}

function lists(raw: unknown): string[][] {
  return Array.isArray(raw) ? raw.filter(isValues).slice(0, RECENT_VALUES_MAX) : [];
}

function names(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

const store = createWorkspacePrefsStore<GitLogRecentFilters>({
  storagePrefix: 'oh:gitLogRecentFilters',
  defaults: { scopes: [], users: [], paths: [], pathNames: {} },
  parse: (p) => ({
    scopes: lists(p.scopes),
    users: lists(p.users),
    paths: lists(p.paths),
    pathNames: names(p.pathNames),
  }),
});

export const getGitLogRecentFilters = store.get;
export const subscribeGitLogRecentFilters = store.subscribe;

/** A filter was applied: its values lead that chip's recent ones. An emptied filter is nothing to remember. */
export function rememberGitLogFilter(workspaceId: string, kind: GitLogRecentKind, values: readonly string[]): void {
  if (values.length === 0) return;
  const recent = store.get(workspaceId);
  store.patch(workspaceId, { ...recent, [kind]: withRecentValues(recent[kind], values) });
}

/**
 * Paths were picked in the tree under these names. The names kept are
 * those of the paths a recent list still holds — the rest go with the
 * lists that named them. Call it after the list itself is remembered.
 */
export function nameGitLogPaths(workspaceId: string, picked: Readonly<Record<string, string>>): void {
  const recent = store.get(workspaceId);
  const held = new Set(recent.paths.flat());
  const pathNames = Object.fromEntries(
    Object.entries({ ...recent.pathNames, ...picked }).filter(([path]) => held.has(path)),
  );
  store.patch(workspaceId, { ...recent, pathNames });
}
