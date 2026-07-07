/**
 * Renderer-side imperative entry point for script-package writes.
 *
 * Mirrors `live-variable-write-client`: write sites build a
 * `MutationBatch` via the shared catalog factories and fire
 * `oh.sync.apply` directly — no SW round-trip per write. Packages are
 * fully flat-scalar so updates are a flat per-key `setField` loop.
 *
 * `name` is the `oh.require` key — uniqueness within the workspace is
 * enforced here at the write boundary (same posture as the variable
 * write sites' duplicate-name checks), for creates and renames alike.
 */

import {
  buildAddScriptPackageBatch,
  buildDeleteScriptPackageBatch,
  buildUpdateScriptPackageBatch,
} from '@openheaders/core/sync-builders/mutations/script-package-mutations';
import type { ScriptPackage } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  getScriptPackageSyncMirrorForWorkspace,
  type ScriptPackageSyncMirror,
} from '../../context/mirrors/script-package-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type ScriptPackageUpdates = Partial<Omit<ScriptPackage, 'uid' | 'path' | 'schemaVersion'>>;

export type ScriptPackageMutationResult =
  | { ok: true; scriptPackage: ScriptPackage }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'duplicate-name' }
  | { ok: false; reason: 'other'; message?: string };

export type ScriptPackageSimpleResult = SyncSimpleResult;

export interface ScriptPackageWriteOptions extends BaseSyncWriteOptions {
  mirror?: ScriptPackageSyncMirror;
}

function nameTaken(mirror: ScriptPackageSyncMirror, name: string, exceptUid?: string): boolean {
  return mirror.listScriptPackages().some((p) => p.name === name && p.uid !== exceptUid);
}

export async function applyScriptPackageCreate(
  request: { scriptPackage: Omit<ScriptPackage, 'uid' | 'path' | 'schemaVersion'> },
  opts: ScriptPackageWriteOptions,
): Promise<ScriptPackageMutationResult> {
  const mirror = resolveMirror(opts, getScriptPackageSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (nameTaken(mirror, request.scriptPackage.name)) return { ok: false, reason: 'duplicate-name' };
  const uid = generateUid();
  const created: ScriptPackage = {
    ...request.scriptPackage,
    schemaVersion: 5 as const,
    uid,
    path: `packages/${toFolderName(request.scriptPackage.name, uid)}`,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildAddScriptPackageBatch(created, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) return { ok: true, scriptPackage: created };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyScriptPackageUpdate(
  scriptPackageUid: string,
  updates: ScriptPackageUpdates,
  opts: ScriptPackageWriteOptions,
): Promise<ScriptPackageMutationResult> {
  const mirror = resolveMirror(opts, getScriptPackageSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getScriptPackageMirror(scriptPackageUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  if (updates.name !== undefined && nameTaken(mirror, updates.name, scriptPackageUid)) {
    return { ok: false, reason: 'duplicate-name' };
  }
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildUpdateScriptPackageBatch(scriptPackageUid, updates, ctx);
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, scriptPackage: { ...entry.scriptPackage, ...updates } as ScriptPackage };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export async function applyScriptPackageDelete(
  scriptPackageUid: string,
  opts: ScriptPackageWriteOptions,
): Promise<ScriptPackageSimpleResult> {
  const mirror = resolveMirror(opts, getScriptPackageSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getScriptPackageMirror(scriptPackageUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildDeleteScriptPackageBatch(scriptPackageUid, ctx);
  return applySyncPayload(payload);
}
