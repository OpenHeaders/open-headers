/**
 * Data API response interpretation — pure and defensive: a malformed
 * envelope becomes a reason, never a throw, and entries the puller
 * cannot act on are counted so the host can surface them as skips
 * (silent lossiness is the one unforgivable bug).
 */

import { isRecord } from '../data-scan/json';
import type { PostmanPullPlan, PullPlanItem, PullWorkspaceSummary } from './types';

export type Interpreted<T> = { ok: true; value: T } | { ok: false; reason: string };

function parseJsonRecord(text: string, what: string): Interpreted<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      reason: `${what} response is not valid JSON — ${err instanceof Error ? err.message : String(err)}.`,
    };
  }
  if (!isRecord(parsed)) return { ok: false, reason: `${what} response is not a JSON object.` };
  return { ok: true, value: parsed };
}

export interface WorkspaceListRead {
  workspaces: PullWorkspaceSummary[];
  /** Entries without a usable id — the host reports them as one skip. */
  malformedEntries: number;
}

/** Interpret the workspace-list envelope: `{ workspaces: [{id, name, type}] }`. */
export function readWorkspaceList(text: string): Interpreted<WorkspaceListRead> {
  const envelope = parseJsonRecord(text, 'Workspace list');
  if (!envelope.ok) return envelope;
  const raw = envelope.value.workspaces;
  if (!Array.isArray(raw)) return { ok: false, reason: 'Workspace list response has no `workspaces` array.' };
  const workspaces: PullWorkspaceSummary[] = [];
  let malformedEntries = 0;
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id === '') {
      malformedEntries++;
      continue;
    }
    workspaces.push({
      id: entry.id,
      name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : entry.id,
      ...(typeof entry.type === 'string' ? { type: entry.type } : {}),
    });
  }
  return { ok: true, value: { workspaces, malformedEntries } };
}

export interface WorkspaceItemRef {
  id: string;
  name?: string;
}

export interface WorkspaceDetail {
  workspaceId: string;
  collections: WorkspaceItemRef[];
  environments: WorkspaceItemRef[];
  /**
   * API specs listed by the workspace. Never pulled — the spec
   * importer hasn't landed — but surfaced so the host can report the
   * "not imported yet" skip instead of silently ignoring the section.
   */
  specs: WorkspaceItemRef[];
  /** Item refs without a usable id — the host reports them as one skip. */
  malformedRefs: number;
}

function readItemRefs(raw: unknown, malformed: { count: number }): WorkspaceItemRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: WorkspaceItemRef[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) {
      malformed.count++;
      continue;
    }
    // Item pulls address the `uid` form (owner-qualified) when present;
    // the bare `id` is the fallback.
    const id = typeof entry.uid === 'string' && entry.uid !== '' ? entry.uid : entry.id;
    if (typeof id !== 'string' || id === '') {
      malformed.count++;
      continue;
    }
    refs.push({ id, ...(typeof entry.name === 'string' && entry.name !== '' ? { name: entry.name } : {}) });
  }
  return refs;
}

/**
 * Spec entries aren't pulled, so a ref without an id is not a lost
 * item — read whatever is nameable without touching the malformed
 * counter that gates real pulls.
 */
function readSpecRefs(raw: unknown): WorkspaceItemRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: WorkspaceItemRef[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === 'string' && entry.id !== '' ? entry.id : '(unknown)';
    refs.push({ id, ...(typeof entry.name === 'string' && entry.name !== '' ? { name: entry.name } : {}) });
  }
  return refs;
}

/** Interpret the workspace-detail envelope: `{ workspace: { collections?, environments?, specs? } }`. */
export function readWorkspaceDetail(workspaceId: string, text: string): Interpreted<WorkspaceDetail> {
  const envelope = parseJsonRecord(text, 'Workspace detail');
  if (!envelope.ok) return envelope;
  const workspace = envelope.value.workspace;
  if (!isRecord(workspace)) return { ok: false, reason: 'Workspace detail response has no `workspace` object.' };
  const malformed = { count: 0 };
  return {
    ok: true,
    value: {
      workspaceId,
      collections: readItemRefs(workspace.collections, malformed),
      environments: readItemRefs(workspace.environments, malformed),
      specs: readSpecRefs(workspace.specs),
      malformedRefs: malformed.count,
    },
  };
}

export interface PulledPayload {
  name?: string;
  /** The unwrapped inner document, re-serialized for the standard parser. */
  json: string;
}

function readWrappedPayload(text: string, key: 'collection' | 'environment', what: string): Interpreted<PulledPayload> {
  const envelope = parseJsonRecord(text, what);
  if (!envelope.ok) return envelope;
  const inner = envelope.value[key];
  if (!isRecord(inner)) return { ok: false, reason: `${what} response has no \`${key}\` object.` };
  const info = isRecord(inner.info) ? inner.info : undefined;
  const name =
    typeof inner.name === 'string'
      ? inner.name
      : info !== undefined && typeof info.name === 'string'
        ? info.name
        : undefined;
  return { ok: true, value: { ...(name !== undefined ? { name } : {}), json: JSON.stringify(inner) } };
}

/** Unwrap `{ collection: {...} }` into the v2.1 JSON `parsePostman` takes. */
export function readCollectionPayload(text: string): Interpreted<PulledPayload> {
  return readWrappedPayload(text, 'collection', 'Collection');
}

/** Unwrap `{ environment: {...} }` into the JSON `parsePostmanEnvironment` takes. */
export function readEnvironmentPayload(text: string): Interpreted<PulledPayload> {
  return readWrappedPayload(text, 'environment', 'Environment');
}

/**
 * Fold enumerated workspaces + details into the pull plan: items dedupe
 * by id (a shared collection pulls once, attributed to every workspace
 * that listed it) and the total call cost is 1 + W + C + E.
 */
export function buildPullPlan(
  workspaces: readonly PullWorkspaceSummary[],
  details: readonly WorkspaceDetail[],
): PostmanPullPlan {
  const byKey = new Map<string, PullPlanItem>();
  for (const detail of details) {
    const refs: Array<{ item: 'collection' | 'environment'; ref: WorkspaceItemRef }> = [
      ...detail.collections.map((ref) => ({ item: 'collection' as const, ref })),
      ...detail.environments.map((ref) => ({ item: 'environment' as const, ref })),
    ];
    for (const { item, ref } of refs) {
      const key = `${item}:${ref.id}`;
      const existing = byKey.get(key);
      if (existing !== undefined) {
        existing.workspaceIds.push(detail.workspaceId);
        if (existing.name === undefined && ref.name !== undefined) existing.name = ref.name;
        continue;
      }
      byKey.set(key, {
        item,
        id: ref.id,
        ...(ref.name !== undefined ? { name: ref.name } : {}),
        workspaceIds: [detail.workspaceId],
      });
    }
  }
  const items = [...byKey.values()];
  return { workspaces: [...workspaces], items, totalCalls: 1 + workspaces.length + items.length };
}
