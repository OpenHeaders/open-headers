/**
 * Live cache blob — storage shape + tolerant normalization, env-key
 * helpers, and the read/write/lock IO primitives shared by every
 * mutation in this folder.
 */

import { initialCircuitSnapshot } from '@openheaders/core/live';
import type { WorkflowRunCache } from '@openheaders/core/types';
import { entityLockName, withLock } from '@openheaders/oracle/coordination';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';

export interface LiveCacheBlob {
  schemaVersion: number;
  version: number;
  runs: Record<string, WorkflowRunCache>;
}

const DEFAULT_BLOB: LiveCacheBlob = { schemaVersion: 5, version: 1, runs: {} };

function normalizeBlob(raw: unknown): LiveCacheBlob {
  if (!raw || typeof raw !== 'object') return DEFAULT_BLOB;
  const blob = raw as Partial<LiveCacheBlob>;
  if (
    typeof blob.schemaVersion !== 'number' ||
    typeof blob.version !== 'number' ||
    !blob.runs ||
    typeof blob.runs !== 'object'
  ) {
    return DEFAULT_BLOB;
  }
  // Per-row tolerant read: inject a default circuit snapshot into any
  // row that predates the circuit-breaker field. This is the ONLY
  // backwards-compat we do — this is pre-release so there's no migration
  // story, but within a single SW lifetime a read could still encounter
  // a storage row written before this module shipped. Safer to heal on
  // read than to crash a scheduler dispatch on `cache.circuit.state`.
  const rawRuns = blob.runs as Record<string, Partial<WorkflowRunCache>>;
  const runs: Record<string, WorkflowRunCache> = {};
  for (const [key, row] of Object.entries(rawRuns)) {
    if (!row || typeof row !== 'object') continue;
    runs[key] = {
      ...(row as WorkflowRunCache),
      circuit: row.circuit ?? initialCircuitSnapshot(),
    };
  }
  return {
    schemaVersion: blob.schemaVersion,
    version: blob.version,
    runs,
  };
}

// ── Env-key helper ─────────────────────────────────────────────────

export const NO_ENV_KEY = '__none__';

export function envKey(environmentId: string | null): string {
  return environmentId ?? NO_ENV_KEY;
}

export function runKey(workflowUid: string, environmentId: string | null): string {
  return `${workflowUid}:${envKey(environmentId)}`;
}

// ── IO ─────────────────────────────────────────────────────────────

export async function readBlob(workspaceId: string): Promise<LiveCacheBlob> {
  const raw = await hostStorage.get(wsKeys(workspaceId).liveCache);
  return normalizeBlob(raw);
}

export async function writeBlob(workspaceId: string, blob: LiveCacheBlob): Promise<void> {
  await hostStorage.set(wsKeys(workspaceId).liveCache, blob);
}

export function resolveWorkspaceId(workspaceId: string | undefined): string {
  return workspaceId ?? requireActiveWorkspaceId();
}

export function withCacheLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(entityLockName(workspaceId, 'live-cache', 'singleton'), fn, { op: 'live-cache-mutate' });
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}
