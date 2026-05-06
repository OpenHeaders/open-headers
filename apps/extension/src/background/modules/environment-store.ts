/**
 * Environment Store — per-workspace environments + active-environment
 * pointer.
 *
 * Separate from rule-store to keep concerns clean: environments drive
 * variable resolution at DNR compile time and only loosely depend on
 * rules (a rule references variables by name, not by environment).
 *
 * Storage keys (scoped to active workspace):
 *   - `oh.ws.<id>.environments`          → Environment[]
 *   - `oh.ws.<id>.activeEnvironmentId`   → string | null
 *   - `oh.ws.<id>.defaultEnvironmentId`  → string | null
 *   - `oh.ws.<id>.workspaceVars`         → WorkspaceVariables
 *   - `oh.ws.<id>.vault`                 → Vault (local-per-device,
 *                                          never synced)
 *
 * "No environment" is a valid state (Postman semantics) — activeId
 * stays null. If a default environment is set, resolution still falls
 * back to it when the active env misses a variable (or when there's no
 * active env at all) — matches ARCHITECTURE.md §5.
 */

import { EnvironmentSchema, VaultSchema, WorkspaceVariablesSchema } from '@openheaders/core/schemas';
import type { V5 } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import {
  ENVIRONMENT_REGISTRATION,
  VAULT_REGISTRATION,
  WORKSPACE_VARIABLES_REGISTRATION,
} from '@/background/sync/entity-registry';
import type { EnvironmentCache } from '@/background/sync/environment-cache';
import { getActiveCacheForRegistration } from '@/background/sync/service';
import type { VaultCache } from '@/background/sync/vault-cache';
import type { WorkspaceVariablesCache } from '@/background/sync/workspace-variables-cache';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { driftRecorder } from './storage-drift';
import { getActiveWorkspaceId } from './workspace-store';

// ── In-memory state ─────────────────────────────────────────────────

let environments: V5.Environment[] = [];
let activeEnvironmentId: string | null = null;
let defaultEnvironmentId: string | null = null;
let collectionEnvOverrides: Record<string, string | null> = {};
// Last env the user manually picked (or null if they chose "No env").
// Feeds the `apply-defaults` auto-switch mode as the base that's
// restored when a collection has no default of its own. Updated only
// on manual picks, not by auto-switch flows.
let manualEnvId: string | null = null;
// Workspace-scoped singletons — Phase B retired the OCC counter (§24);
// concurrent edits reconcile through HLC LWW at the oracle.
let workspaceVariables: V5.WorkspaceVariables = { schemaVersion: 5, variables: [] };
let vault: V5.Vault = { schemaVersion: 5, secrets: [] };
let loadedWorkspaceId: string | null = null;

// ── Change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onEnvironmentStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(): void {
  for (const fn of listeners) fn();
}

/**
 * Active-environment-pointer listeners. Same separation rationale as
 * `onActiveWorkspaceChange` in `workspace-store.ts` — the generic
 * `onEnvironmentStoreChange` fires on every variable edit, env rename,
 * etc., but reactive consumers (the live-refresh scheduler's
 * switch-warm pass) only care when the active env actually flips.
 */
type ActiveEnvironmentListener = (newId: string | null, prevId: string | null) => void;
const activeListeners: Set<ActiveEnvironmentListener> = new Set();

export function onActiveEnvironmentChange(listener: ActiveEnvironmentListener): () => void {
  activeListeners.add(listener);
  return () => activeListeners.delete(listener);
}

function notifyActiveChange(newId: string | null, prevId: string | null): void {
  for (const fn of activeListeners) {
    try {
      fn(newId, prevId);
    } catch {
      // Listener errors don't unwind the switch.
    }
  }
}

// ── Reads ───────────────────────────────────────────────────────────

export function getEnvironments(): V5.Environment[] {
  return environments;
}

export function getActiveEnvironmentId(): string | null {
  return activeEnvironmentId;
}

export function getActiveEnvironment(): V5.Environment | null {
  if (!activeEnvironmentId) return null;
  return environments.find((e) => e.uid === activeEnvironmentId) ?? null;
}

export function getDefaultEnvironmentId(): string | null {
  return defaultEnvironmentId;
}

export function getDefaultEnvironment(): V5.Environment | null {
  if (!defaultEnvironmentId) return null;
  return environments.find((e) => e.uid === defaultEnvironmentId) ?? null;
}

export function getCollectionEnvOverrides(): Readonly<Record<string, string | null>> {
  return collectionEnvOverrides;
}

export function getManualEnvId(): string | null {
  return manualEnvId;
}

export function getWorkspaceVariables(): V5.WorkspaceVariables {
  return workspaceVariables;
}

export function getVault(): V5.Vault {
  return vault;
}

// ── Environments CRUD ──────────────────────────────────────────────

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('EnvironmentStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

export function createEnvironment(name: string, variables: V5.Variable[] = []): V5.Environment {
  const env: V5.Environment = {
    schemaVersion: 5,
    uid: generateUid(),
    name: name.trim() || 'Untitled Environment',
    variables,
  };
  environments = [...environments, env];
  void persistEnvironments();
  return env;
}

/**
 * Outcome of an environment write. Phase B retired the stale-draft
 * branch (§24) — concurrent edits reconcile via HLC LWW at the oracle.
 */
export type EnvironmentWriteResult = { ok: true; environment: V5.Environment } | { ok: false; reason: 'not-found' };

export async function renameEnvironment(uid: string, name: string): Promise<EnvironmentWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'environment', uid),
    async () => {
      const idx = environments.findIndex((e) => e.uid === uid);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const existing = environments[idx];
      const updated: V5.Environment = {
        ...existing,
        name: name.trim() || existing.name,
      };
      environments = [...environments.slice(0, idx), updated, ...environments.slice(idx + 1)];
      await persistEnvironments();
      return { ok: true, environment: updated };
    },
    { op: 'environment-rename' },
  );
}

export async function updateEnvironmentVariables(
  uid: string,
  variables: V5.Variable[],
): Promise<EnvironmentWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'environment', uid),
    async () => {
      const idx = environments.findIndex((e) => e.uid === uid);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const existing = environments[idx];
      const updated: V5.Environment = { ...existing, variables };
      environments = [...environments.slice(0, idx), updated, ...environments.slice(idx + 1)];
      await persistEnvironments();
      return { ok: true, environment: updated };
    },
    { op: 'environment-variables' },
  );
}

export async function deleteEnvironment(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'environment', uid),
    async () => {
      const before = environments.length;
      environments = environments.filter((e) => e.uid !== uid);
      if (environments.length === before) return false;
      const prevActive = activeEnvironmentId;
      const wasActive = activeEnvironmentId === uid;
      if (wasActive) {
        activeEnvironmentId = null;
        await persistActiveEnvironment();
      }
      if (defaultEnvironmentId === uid) {
        defaultEnvironmentId = null;
        await persistDefaultEnvironment();
      }
      if (manualEnvId === uid) {
        manualEnvId = null;
        await persistManualEnvId();
      }
      const prevOverrides = collectionEnvOverrides;
      collectionEnvOverrides = reconcileOverrides(collectionEnvOverrides, environments);
      if (JSON.stringify(prevOverrides) !== JSON.stringify(collectionEnvOverrides)) {
        await extensionStorage.set(wsKeys(workspaceId).collectionEnvOverrides, collectionEnvOverrides);
      }
      await persistEnvironments();
      // Auto-clearing the active env after deletion IS a switch — the
      // user's resolution context flipped from `env-X` to "No
      // environment". Reactive subscribers (live-refresh scheduler's
      // switch-warm pass) must see it as one so the new context's
      // missing/stale cache rows get refreshed.
      if (wasActive) {
        notifyActiveChange(null, prevActive);
      }
      return true;
    },
    { op: 'environment-delete' },
  );
}

/**
 * Set the active environment, or clear it (null = "No environment",
 * Postman semantics). No-op if the id is invalid.
 */
export async function setActiveEnvironment(uid: string | null): Promise<boolean> {
  if (uid !== null && !environments.some((e) => e.uid === uid)) return false;
  if (activeEnvironmentId === uid) return true;
  const prevId = activeEnvironmentId;
  activeEnvironmentId = uid;
  await persistActiveEnvironment();
  notifyActiveChange(uid, prevId);
  return true;
}

/**
 * Pick the workspace's default environment. Resolution falls back to
 * this env when the active env is missing a variable (or when there's
 * no active env). Pass `null` to clear — resolution behaves flat again.
 * No-op if the uid doesn't match an existing environment.
 */
export async function setDefaultEnvironment(uid: string | null): Promise<boolean> {
  if (uid !== null && !environments.some((e) => e.uid === uid)) return false;
  if (defaultEnvironmentId === uid) return true;
  defaultEnvironmentId = uid;
  await persistDefaultEnvironment();
  return true;
}

export async function setManualEnv(uid: string | null): Promise<boolean> {
  if (uid !== null && !environments.some((e) => e.uid === uid)) return false;
  if (manualEnvId === uid) return true;
  manualEnvId = uid;
  await persistManualEnvId();
  return true;
}

export async function setCollectionEnvOverride(collectionId: string, envId: string | null | undefined): Promise<void> {
  const workspaceId = assertLoaded();
  const next = { ...collectionEnvOverrides };
  if (envId === undefined) {
    delete next[collectionId];
  } else {
    next[collectionId] = envId;
  }
  collectionEnvOverrides = next;
  await extensionStorage.set(wsKeys(workspaceId).collectionEnvOverrides, collectionEnvOverrides);
  notifyChange();
}

function reconcileOverrides(
  overrides: Record<string, string | null>,
  envs: V5.Environment[],
): Record<string, string | null> {
  const known = new Set(envs.map((e) => e.uid));
  const result: Record<string, string | null> = {};
  for (const [cid, envId] of Object.entries(overrides)) {
    if (envId === null || known.has(envId)) result[cid] = envId;
  }
  return result;
}

// ── Persistence ─────────────────────────────────────────────────────

async function persistEnvironments(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).environments, environments);
  logger.debug('EnvironmentStore', `Persisted ${environments.length} envs (ws=${workspaceId})`);
  notifyChange();
}

async function persistActiveEnvironment(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).activeEnvironmentId, activeEnvironmentId);
  notifyChange();
}

async function persistDefaultEnvironment(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).defaultEnvironmentId, defaultEnvironmentId);
  notifyChange();
}

async function persistManualEnvId(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).manualEnvId, manualEnvId);
  notifyChange();
}

// ── Hydration / workspace switch ───────────────────────────────────

interface WorkspaceSnapshot {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
  collectionEnvOverrides: Record<string, string | null>;
  manualEnvId: string | null;
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  const keys = wsKeys(workspaceId);
  const drift = (storageKey: string) => driftRecorder({ subsystem: 'environment', storageKey, workspaceId });
  // Vault drift is a `secrets` concern — both observability-tagged as `vault`
  // and promoted to the `secrets` Status subsystem so the user sees a yellow
  // pill if a vault entry vanishes on hydrate.
  const vaultDrift = driftRecorder({
    subsystem: 'vault',
    statusSubsystem: 'secrets',
    storageKey: keys.vault.key,
    workspaceId,
  });

  const [
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    workspaceVariables,
    vault,
    rawOverrides,
    manualEnvId,
  ] = await Promise.all([
    extensionStorage.getValidatedArray(keys.environments, EnvironmentSchema, {
      onError: drift(keys.environments.key),
    }),
    extensionStorage.get(keys.activeEnvironmentId),
    extensionStorage.get(keys.defaultEnvironmentId),
    extensionStorage.getValidated(keys.workspaceVars, WorkspaceVariablesSchema, {
      onError: drift(keys.workspaceVars.key),
    }),
    extensionStorage.getValidated(keys.vault, VaultSchema, { onError: vaultDrift }),
    extensionStorage.get(keys.collectionEnvOverrides),
    extensionStorage.get(keys.manualEnvId),
  ]);

  const parsedOverrides: Record<string, string | null> =
    rawOverrides !== null &&
    rawOverrides !== undefined &&
    typeof rawOverrides === 'object' &&
    !Array.isArray(rawOverrides)
      ? (rawOverrides as Record<string, string | null>)
      : {};

  return {
    environments,
    activeEnvironmentId: typeof activeEnvironmentId === 'string' ? activeEnvironmentId : null,
    defaultEnvironmentId: typeof defaultEnvironmentId === 'string' ? defaultEnvironmentId : null,
    workspaceVariables: workspaceVariables ?? { schemaVersion: 5, variables: [] },
    vault: vault ?? { schemaVersion: 5, secrets: [] },
    collectionEnvOverrides: parsedOverrides,
    manualEnvId: typeof manualEnvId === 'string' ? manualEnvId : null,
  };
}

/**
 * Reconcile persisted pointer ids against the loaded environment list.
 * Drops any stale id whose env no longer exists.
 */
function reconcilePointer(persisted: string | null, envs: V5.Environment[]): string | null {
  return persisted && envs.some((e) => e.uid === persisted) ? persisted : null;
}

export async function hydrateEnvironmentsFromStorage(): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  environments = snapshot.environments;
  activeEnvironmentId = reconcilePointer(snapshot.activeEnvironmentId, environments);
  defaultEnvironmentId = reconcilePointer(snapshot.defaultEnvironmentId, environments);
  workspaceVariables = snapshot.workspaceVariables;
  vault = snapshot.vault;
  collectionEnvOverrides = reconcileOverrides(snapshot.collectionEnvOverrides, environments);
  manualEnvId = reconcilePointer(snapshot.manualEnvId, environments);
  loadedWorkspaceId = workspaceId;
  logger.info(
    'EnvironmentStore',
    `Hydrated ws=${workspaceId}: ${environments.length} envs, active=${activeEnvironmentId ?? 'none'}, default=${defaultEnvironmentId ?? 'none'}`,
  );
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  environments = snapshot.environments;
  activeEnvironmentId = reconcilePointer(snapshot.activeEnvironmentId, environments);
  defaultEnvironmentId = reconcilePointer(snapshot.defaultEnvironmentId, environments);
  workspaceVariables = snapshot.workspaceVariables;
  vault = snapshot.vault;
  collectionEnvOverrides = reconcileOverrides(snapshot.collectionEnvOverrides, environments);
  manualEnvId = reconcilePointer(snapshot.manualEnvId, environments);
  loadedWorkspaceId = workspaceId;
  logger.info(
    'EnvironmentStore',
    `Switched to ws=${workspaceId}: ${environments.length} envs, active=${activeEnvironmentId ?? 'none'}, default=${defaultEnvironmentId ?? 'none'}`,
  );
  notifyChange();
}

/**
 * Drop every environment/vars/vault key for a workspace. Called on
 * workspace delete so the storage quota isn't bloated by orphan data.
 */
export async function purgeWorkspaceEnvironmentData(workspaceId: string): Promise<void> {
  const keys = wsKeys(workspaceId);
  await extensionStorage.remove([
    keys.environments,
    keys.activeEnvironmentId,
    keys.defaultEnvironmentId,
    keys.workspaceVars,
    keys.vault,
    keys.collectionEnvOverrides,
    keys.manualEnvId,
  ]);
}

// ── Sync engine bridge ──────────────────────────────────────────────

let envCacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local `environments` array to the active workspace's
 * {@link EnvironmentCache}: seed the oracle from the hydrated env list,
 * then subscribe to broadcast-driven re-projections so subsequent
 * mutations flow back into the local mirror. Mirrors
 * `rule-store.bridgeToSyncEngine`.
 *
 * Call AFTER `initSyncService(workspaceId)` AND AFTER
 * `hydrateEnvironmentsFromStorage()` (or `switchToWorkspace`).
 * Re-runs are safe — the prior cache subscription is dropped first.
 */
export async function bridgeEnvironmentSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<EnvironmentCache>(ENVIRONMENT_REGISTRATION);
  if (!cache) {
    logger.info('EnvironmentStore', 'bridgeEnvironmentSyncEngine: no active cache; skipping');
    return;
  }
  if (envCacheUnsubscribe) {
    envCacheUnsubscribe();
    envCacheUnsubscribe = null;
  }
  envCacheUnsubscribe = cache.onChange(() => {
    environments = cache.getEnvironments();
    notifyChange();
  });
  await cache.seedFromPersistedEnvironments(environments);
  // Belt-and-braces — pick up the cache view explicitly so a
  // zero-environments workspace (no broadcasts → no listener fire)
  // still ends with `environments` pointed at the cache snapshot.
  environments = cache.getEnvironments();
}

// ── Workspace variables sync bridge ───────────────────────────────

let workspaceVarsCacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local `workspaceVariables` singleton to the active
 * workspace's {@link WorkspaceVariablesCache}: seed the oracle from
 * the hydrated record, then subscribe to broadcast-driven re-projections
 * so subsequent mutations flow back into the local mirror. Mirrors
 * `bridgeEnvironmentSyncEngine`.
 */
export async function bridgeWorkspaceVariablesSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<WorkspaceVariablesCache>(WORKSPACE_VARIABLES_REGISTRATION);
  if (!cache) {
    logger.info('EnvironmentStore', 'bridgeWorkspaceVariablesSyncEngine: no active cache; skipping');
    return;
  }
  if (workspaceVarsCacheUnsubscribe) {
    workspaceVarsCacheUnsubscribe();
    workspaceVarsCacheUnsubscribe = null;
  }
  workspaceVarsCacheUnsubscribe = cache.onChange(() => {
    workspaceVariables = cache.getWorkspaceVariables();
    notifyChange();
  });
  await cache.seedFromPersistedWorkspaceVariables(workspaceVariables);
  workspaceVariables = cache.getWorkspaceVariables();
}

// ── Vault sync bridge ─────────────────────────────────────────────

let vaultCacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local `vault` singleton to the active workspace's
 * {@link VaultCache}: seed the oracle from the hydrated record, then
 * subscribe to broadcast-driven re-projections so subsequent mutations
 * flow back into the local mirror. Mirrors
 * `bridgeWorkspaceVariablesSyncEngine`.
 *
 * Vault is non-syncing in v1 (§12.3) — the broadcast pipe is
 * local-machine only and the cache's persistence sink stays inside
 * `chrome.storage.local`.
 */
export async function bridgeVaultSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<VaultCache>(VAULT_REGISTRATION);
  if (!cache) {
    logger.info('EnvironmentStore', 'bridgeVaultSyncEngine: no active cache; skipping');
    return;
  }
  if (vaultCacheUnsubscribe) {
    vaultCacheUnsubscribe();
    vaultCacheUnsubscribe = null;
  }
  vaultCacheUnsubscribe = cache.onChange(() => {
    vault = cache.getVault();
    notifyChange();
  });
  await cache.seedFromPersistedVault(vault);
  vault = cache.getVault();
}

// ── Test helpers ───────────────────────────────────────────────────

export function __resetForTests(): void {
  environments = [];
  activeEnvironmentId = null;
  defaultEnvironmentId = null;
  collectionEnvOverrides = {};
  manualEnvId = null;
  workspaceVariables = { schemaVersion: 5, variables: [] };
  vault = { schemaVersion: 5, secrets: [] };
  loadedWorkspaceId = null;
  listeners.clear();
}
