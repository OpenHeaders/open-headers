/**
 * TemplateInput recents — per-workspace LRU of recently-inserted
 * `{{scope.name}}` references.
 *
 * Surfaced at the top of the suggestion list when the popover opens
 * with an empty query (the Phase E polish item in the plan). Capped at
 * {@link RECENTS_CAP} entries, dedup'd by reference, pruned against
 * the currently-valid suggestion set so deleted variables don't
 * linger.
 *
 * Not synced, not shared — each user's recency list is their own.
 * Chrome.storage.local only.
 */

import { extensionStorage } from '@/shared/storage/extension-storage';
import { type StorageKey, storageKey } from '@/shared/storage/keys';

export const RECENTS_CAP = 8;
export const RECENTS_SCHEMA_VERSION = 5 as const;

export interface VariableRecentEntry {
  reference: string;
  insertedAt: number;
}

export interface VariableRecents {
  schemaVersion: typeof RECENTS_SCHEMA_VERSION;
  entries: VariableRecentEntry[];
}

function recentsKey(workspaceId: string): StorageKey<VariableRecents> {
  return storageKey<VariableRecents>(`oh.ws.${workspaceId}.variableRecents`);
}

function empty(): VariableRecents {
  return { schemaVersion: RECENTS_SCHEMA_VERSION, entries: [] };
}

/**
 * Load the recents list for the given workspace. Returns an empty list
 * when the slot is absent or malformed. Tolerates schemaVersion drift
 * by falling back to empty — recents are ephemeral UX sugar, not data.
 */
export async function listRecents(workspaceId: string | null): Promise<VariableRecents> {
  if (!workspaceId) return empty();
  const raw = await extensionStorage.get(recentsKey(workspaceId)).catch(() => undefined);
  if (!raw || typeof raw !== 'object') return empty();
  const candidate = raw as Partial<VariableRecents>;
  if (candidate.schemaVersion !== RECENTS_SCHEMA_VERSION) return empty();
  if (!Array.isArray(candidate.entries)) return empty();
  const entries: VariableRecentEntry[] = [];
  for (const e of candidate.entries) {
    if (!e || typeof e !== 'object') continue;
    const ent = e as Partial<VariableRecentEntry>;
    if (typeof ent.reference !== 'string' || typeof ent.insertedAt !== 'number') continue;
    entries.push({ reference: ent.reference, insertedAt: ent.insertedAt });
  }
  return { schemaVersion: RECENTS_SCHEMA_VERSION, entries };
}

/**
 * Record a reference as the most-recently-inserted. Dedups by
 * reference (moves an existing entry to the front), caps the list at
 * {@link RECENTS_CAP}. No-op when `workspaceId` is null — avoids
 * wiring a "no workspace selected" branch into every call site.
 */
export async function addRecent(workspaceId: string | null, reference: string): Promise<void> {
  if (!workspaceId) return;
  const current = await listRecents(workspaceId);
  const now = Date.now();
  const filtered = current.entries.filter((e) => e.reference !== reference);
  const next: VariableRecents = {
    schemaVersion: RECENTS_SCHEMA_VERSION,
    entries: [{ reference, insertedAt: now }, ...filtered].slice(0, RECENTS_CAP),
  };
  await extensionStorage.set(recentsKey(workspaceId), next).catch(() => undefined);
}

/**
 * Drop recents whose reference no longer appears in `validReferences`.
 * Callers pass the current suggestion-set's references so stale
 * recents (variable renamed / deleted) don't take a slot in the list.
 */
export async function pruneRecents(
  workspaceId: string | null,
  validReferences: ReadonlySet<string>,
): Promise<VariableRecents> {
  if (!workspaceId) return empty();
  const current = await listRecents(workspaceId);
  const surviving = current.entries.filter((e) => validReferences.has(e.reference));
  if (surviving.length === current.entries.length) return current;
  const next: VariableRecents = { schemaVersion: RECENTS_SCHEMA_VERSION, entries: surviving };
  await extensionStorage.set(recentsKey(workspaceId), next).catch(() => undefined);
  return next;
}
