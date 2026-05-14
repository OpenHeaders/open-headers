/**
 * Renderer-side imperative entry point for ExtensionWorkspace writes.
 *
 * Mirrors the per-entity write-client pattern (rule, env, request,
 * etc.) but operates at the GLOBAL scope — every helper threads
 * `ensureGlobalRendererContext` for the per-surface HLC sequencer and
 * resolves the global ExtensionWorkspace sync mirror for orderKey
 * lookups + last-workspace / active-pointer orchestration that lived
 * in the SW's `workspace-store.ts` write functions.
 *
 * Per-batch all-or-nothing at the global oracle (§11.2) keeps observers
 * from seeing a half-applied delete (slot removed, active dangling).
 *
 * NOT YET WIRED INTO `useWorkspaces.ts` — scaffold lands ahead of the
 * call-site migration so the diff is reviewable in isolation. Until
 * `useWorkspaces.ts` flips, the bridge RPC path stays authoritative
 * and these helpers are dead code.
 *
 * `duplicateWorkspace` stays on the bridge: it copies per-workspace
 * data across SW-owned stores (rule / template / files / etc.) which
 * the renderer can't touch. The other six write paths (create / update
 * / delete / setActive / reorder / rename) are renderer-direct here.
 */

import {
  applySyncPayload,
  type SyncMutationPayload,
  type SyncSimpleResult,
} from './apply-payload';
import {
  buildMoveExtensionWorkspaceBeforeBatch,
  buildRemoveExtensionWorkspaceBatch,
  buildSetActiveExtensionWorkspaceBatch,
  buildSetExtensionWorkspaceBatch,
} from '@openheaders/core/sync-builders/extension-workspace-mutations';
import {
  type ExtensionWorkspaceSlot,
  keyBetween,
  type MutationBatch,
  type MutatorContext,
  seedKey,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { ExtensionWorkspace, ExtensionWorkspaceKind } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  type ExtensionWorkspaceSyncMirror,
  getActiveExtensionWorkspaceSyncMirror,
} from '../../context/extension-workspace-sync-mirror';
import {
  ensureGlobalRendererContext,
  type RendererContextHandle,
} from '../../context/renderer-mutator-context';

export type ExtensionWorkspaceSimpleResult = SyncSimpleResult;

/**
 * Common shape for every helper in this module. The global write path
 * doesn't carry `workspaceId` (every emission targets the global scope)
 * — instead the surface attribution alone keys the per-surface
 * sequencer.
 */
export interface ExtensionWorkspaceWriteOptions {
  surfaceId: string;
  /** Override the renderer context handle for tests. */
  context?: RendererContextHandle;
  /** Override the active mirror for tests. */
  mirror?: ExtensionWorkspaceSyncMirror;
  /** Optional batchId so multi-mutation gestures share one all-or-nothing batch. */
  batchId?: string;
}

function resolveContext(opts: ExtensionWorkspaceWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureGlobalRendererContext({ surfaceId: opts.surfaceId });
}

function tailOrderKey(mirror: ExtensionWorkspaceSyncMirror): string {
  // Rendererside mirror exposes orderKeys keyed by id. The last entry
  // in `liveWorkspaces()` carries the maximum key (post-state already
  // sorts ascending). Fall back to seedKey when the mirror is empty.
  const ws = mirror.liveWorkspaces();
  if (ws.length === 0) return seedKey();
  const last = ws[ws.length - 1];
  const maxKey = mirror.liveOrderKey(last.id);
  if (!maxKey) return seedKey();
  return keyBetween(maxKey, null);
}

// ── create ──────────────────────────────────────────────────────────

export interface ApplyCreateWorkspaceInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  kind?: ExtensionWorkspaceKind;
}

export type ApplyCreateWorkspaceResult =
  | { ok: true; workspace: ExtensionWorkspace }
  | { ok: false; reason: 'other'; message?: string };

/**
 * Mint a new workspace at the tail of the list. Returns the
 * post-broadcast `ExtensionWorkspace` projection (sortIndex assigned
 * by the post-state) — the caller is expected to await the next mirror
 * tick for the projected entry; this helper returns the synthetic slot
 * mapped to `ExtensionWorkspace` shape so navigation can proceed
 * without a round-trip wait.
 */
export async function applyCreateWorkspace(
  input: ApplyCreateWorkspaceInput,
  opts: ExtensionWorkspaceWriteOptions,
): Promise<ApplyCreateWorkspaceResult> {
  const mirror = opts.mirror ?? getActiveExtensionWorkspaceSyncMirror();
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const now = new Date().toISOString();
  const id = generateUid();
  const slot: ExtensionWorkspaceSlot = {
    id,
    kind: input.kind ?? 'personal',
    name: input.name.trim() || 'Untitled Workspace',
    description: input.description,
    color: input.color,
    icon: input.icon,
    createdAt: now,
    updatedAt: now,
  };
  const orderKey = tailOrderKey(mirror);
  const payload = buildSetExtensionWorkspaceBatch({ slot, orderKey }, ctx);
  const result = await applySyncPayload(payload);
  if (!result.ok) return { ok: false, reason: 'other', message: result.reason === 'other' ? result.message : undefined };
  // Synthetic projection — sortIndex matches post-state's monotonic
  // assignment for the new tail position. The mirror will overwrite
  // this on the next broadcast tick.
  const sortIndex = mirror.liveWorkspaces().length;
  const workspace: ExtensionWorkspace = {
    schemaVersion: 5,
    id,
    kind: slot.kind,
    name: slot.name,
    description: slot.description,
    color: slot.color,
    icon: slot.icon,
    sortIndex,
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, workspace };
}

// ── update / rename ─────────────────────────────────────────────────

export interface ApplyUpdateWorkspaceInput {
  id: string;
  /**
   * Patch shape mirrors `UpdateWorkspaceInput` from `workspace-store`.
   * Icon `null` clears the icon; `undefined` leaves it untouched; a
   * string value sets it.
   */
  updates: {
    name?: string;
    description?: string;
    color?: string;
    icon?: string | null;
  };
}

export type ApplyUpdateWorkspaceResult =
  | { ok: true; workspace: ExtensionWorkspace }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export async function applyUpdateWorkspace(
  input: ApplyUpdateWorkspaceInput,
  opts: ExtensionWorkspaceWriteOptions,
): Promise<ApplyUpdateWorkspaceResult> {
  const mirror = opts.mirror ?? getActiveExtensionWorkspaceSyncMirror();
  const prev = mirror.liveWorkspaces().find((w) => w.id === input.id);
  if (!prev) return { ok: false, reason: 'not-found' };

  const orderKey = mirror.liveOrderKey(input.id) ?? seedKey();
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const updates = input.updates;
  const next: ExtensionWorkspaceSlot = {
    id: input.id,
    kind: prev.kind,
    name: updates.name !== undefined ? updates.name.trim() || prev.name : prev.name,
    description: updates.description !== undefined ? updates.description : prev.description,
    color: updates.color !== undefined ? updates.color : prev.color,
    icon:
      updates.icon === null
        ? undefined
        : updates.icon !== undefined
          ? updates.icon
          : prev.icon,
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString(),
    source: prev.source,
  };
  const payload = buildSetExtensionWorkspaceBatch({ slot: next, orderKey }, ctx);
  const result = await applySyncPayload(payload);
  if (!result.ok)
    return { ok: false, reason: 'other', message: result.reason === 'other' ? result.message : undefined };
  // Project the new slot onto the live shape — sortIndex preserved
  // from the pre-image (rename doesn't change position).
  const workspace: ExtensionWorkspace = {
    schemaVersion: 5,
    id: input.id,
    kind: next.kind,
    name: next.name,
    description: next.description,
    color: next.color,
    icon: next.icon,
    sortIndex: prev.sortIndex,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
    source: next.source,
  };
  return { ok: true, workspace };
}

export async function applyRenameWorkspace(
  input: { id: string; name: string },
  opts: ExtensionWorkspaceWriteOptions,
): Promise<ApplyUpdateWorkspaceResult> {
  return applyUpdateWorkspace({ id: input.id, updates: { name: input.name } }, opts);
}

// ── delete ──────────────────────────────────────────────────────────

export interface ApplyDeleteWorkspaceInput {
  id: string;
}

export type ApplyDeleteWorkspaceResult =
  | { ok: true; activeWorkspaceId: string }
  | { ok: false; reason: 'last-workspace' }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

/**
 * Delete a workspace, bundling the active-pointer flip into the same
 * batch when the active workspace is the target — per-batch
 * all-or-nothing keeps the active pointer from dangling on a deleted id.
 *
 * `last-workspace` rejection mirrors the SW guard: the list cannot
 * shrink below 1 entry. UI should disable the delete button when the
 * mirror reports a single workspace.
 */
export async function applyDeleteWorkspace(
  input: ApplyDeleteWorkspaceInput,
  opts: ExtensionWorkspaceWriteOptions,
): Promise<ApplyDeleteWorkspaceResult> {
  const mirror = opts.mirror ?? getActiveExtensionWorkspaceSyncMirror();
  const list = mirror.liveWorkspaces();
  if (list.length <= 1) return { ok: false, reason: 'last-workspace' };

  const idx = list.findIndex((w) => w.id === input.id);
  if (idx === -1) return { ok: false, reason: 'not-found' };

  const activeId = mirror.liveActiveWorkspaceId();
  const wasActive = activeId === input.id;
  let neighbourId: string | null = null;
  if (wasActive) {
    // Pick neighbour: previous in sort order, else first remaining.
    // The mirror's list is already sorted by orderKey ascending, so
    // index-based selection matches the SW's `compareWorkspaces`
    // outcome.
    const remaining = list.filter((w) => w.id !== input.id);
    neighbourId = remaining[Math.max(0, idx - 1)]?.id ?? remaining[0]?.id ?? null;
  }

  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const remove = buildRemoveExtensionWorkspaceBatch({ id: input.id }, ctx);
  let payload: SyncMutationPayload = remove;
  let nextActive = wasActive ? (neighbourId ?? input.id) : (activeId ?? input.id);
  if (wasActive && neighbourId) {
    const sharedCtx: MutatorContext = { ...ctx, batchId: remove.batch.batchId };
    const setActive = buildSetActiveExtensionWorkspaceBatch({ id: neighbourId }, sharedCtx);
    const merged: MutationBatch = {
      batchId: remove.batch.batchId,
      mutations: [...remove.batch.mutations, ...setActive.batch.mutations],
    };
    const sideEffects: SideEffectIntent[] = [...remove.sideEffects, ...setActive.sideEffects];
    payload = { batch: merged, sideEffects };
    nextActive = neighbourId;
  }
  const result = await applySyncPayload(payload);
  if (!result.ok)
    return { ok: false, reason: 'other', message: result.reason === 'other' ? result.message : undefined };
  return { ok: true, activeWorkspaceId: nextActive };
}

// ── setActive ───────────────────────────────────────────────────────

export interface ApplySetActiveWorkspaceInput {
  id: string;
}

export type ApplySetActiveWorkspaceResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export async function applySetActiveWorkspace(
  input: ApplySetActiveWorkspaceInput,
  opts: ExtensionWorkspaceWriteOptions,
): Promise<ApplySetActiveWorkspaceResult> {
  const mirror = opts.mirror ?? getActiveExtensionWorkspaceSyncMirror();
  if (!mirror.liveWorkspaces().some((w) => w.id === input.id)) {
    return { ok: false, reason: 'not-found' };
  }
  if (mirror.liveActiveWorkspaceId() === input.id) return { ok: true };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildSetActiveExtensionWorkspaceBatch({ id: input.id }, ctx);
  const result = await applySyncPayload(payload);
  if (!result.ok)
    return { ok: false, reason: 'other', message: result.reason === 'other' ? result.message : undefined };
  return { ok: true };
}

// ── reorder ─────────────────────────────────────────────────────────

export interface ApplyReorderWorkspacesInput {
  /** Desired id sequence. Ids absent from the input are appended at the
   *  tail in their current sort order. Unknown ids are ignored. */
  idOrder: readonly string[];
}

/**
 * Re-sequence the workspace list. The renderer mints a fresh strictly-
 * increasing sequence of fractional-indexing keys for the final
 * positions; concurrent reorders converge by per-(setPath, itemId) LWW
 * at the oracle. Empty diff is short-circuited.
 */
export async function applyReorderWorkspaces(
  input: ApplyReorderWorkspacesInput,
  opts: ExtensionWorkspaceWriteOptions,
): Promise<ExtensionWorkspaceSimpleResult> {
  const mirror = opts.mirror ?? getActiveExtensionWorkspaceSyncMirror();
  const list = mirror.liveWorkspaces();
  const byId = new Map(list.map((w) => [w.id, w] as const));
  const seen = new Set<string>();
  const finalOrder: string[] = [];
  for (const id of input.idOrder) {
    if (!byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    finalOrder.push(id);
  }
  for (const ws of list) {
    if (seen.has(ws.id)) continue;
    finalOrder.push(ws.id);
  }
  if (finalOrder.length === 0) return { ok: true };

  const newKeys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < finalOrder.length; i++) {
    const k: string = i === 0 ? seedKey() : keyBetween(prev, null);
    newKeys.push(k);
    prev = k;
  }

  const handle = resolveContext(opts);
  const baseCtx = handle.next(opts.batchId ? { batchId: opts.batchId } : undefined);
  let combined: MutationBatch | null = null;
  const sideEffects: SideEffectIntent[] = [];
  for (let i = 0; i < finalOrder.length; i++) {
    const ctx: MutatorContext =
      combined === null ? baseCtx : { ...baseCtx, batchId: combined.batchId };
    const intent = buildMoveExtensionWorkspaceBeforeBatch(
      { id: finalOrder[i], orderKey: newKeys[i] },
      ctx,
    );
    if (combined === null) {
      combined = intent.batch;
    } else {
      combined.mutations.push(...intent.batch.mutations);
    }
    sideEffects.push(...intent.sideEffects);
  }
  if (!combined || combined.mutations.length === 0) return { ok: true };
  const result = await applySyncPayload({ batch: combined, sideEffects });
  if (!result.ok)
    return { ok: false, reason: 'other', message: result.reason === 'other' ? result.message : undefined };
  return { ok: true };
}
