/**
 * git-log-recent-filters — per workspace, the log's filters applied
 * last, newest first: what the Branch, User and Paths chips' Recent
 * rows list. Durable lists, like the rail's favorites — the shared
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
}

export type GitLogRecentKind = keyof GitLogRecentFilters;

function isValues(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.length > 0);
}

function lists(raw: unknown): string[][] {
  return Array.isArray(raw) ? raw.filter(isValues).slice(0, RECENT_VALUES_MAX) : [];
}

const store = createWorkspacePrefsStore<GitLogRecentFilters>({
  storagePrefix: 'oh:gitLogRecentFilters',
  defaults: { scopes: [], users: [], paths: [] },
  parse: (p) => ({ scopes: lists(p.scopes), users: lists(p.users), paths: lists(p.paths) }),
});

export const getGitLogRecentFilters = store.get;
export const subscribeGitLogRecentFilters = store.subscribe;

/** A filter was applied: its values lead that chip's recent ones. An emptied filter is nothing to remember. */
export function rememberGitLogFilter(workspaceId: string, kind: GitLogRecentKind, values: readonly string[]): void {
  if (values.length === 0) return;
  const recent = store.get(workspaceId);
  store.patch(workspaceId, { ...recent, [kind]: withRecentValues(recent[kind], values) });
}
