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
import type { Environment, Variable, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { generateUid, logger } from '@openheaders/core/utils';
import { entityLockName, withLock } from '@openheaders/oracle/coordination';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';
import type { EnvironmentCache } from '@openheaders/oracle/sync/caches/environment-cache';
import type { VaultCache } from '@openheaders/oracle/sync/caches/vault-cache';
import type { WorkspaceVariablesCache } from '@openheaders/oracle/sync/caches/workspace-variables-cache';
import {
  ENVIRONMENT_REGISTRATION,
  VAULT_REGISTRATION,
  WORKSPACE_VARIABLES_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
import { getActiveCacheForRegistration, getCacheForWorkspace } from '@openheaders/oracle/sync/service';
import { driftRecorder } from '@openheaders/oracle/sync/storage-drift';

// ── In-memory state ─────────────────────────────────────────────────

let environments: Environment[] = [];
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
let workspaceVariables: WorkspaceVariables = { schemaVersion: 5, variables: [] };
let vault: Vault = { schemaVersion: 5, secrets: [] };
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

export function getEnvironments(): Environment[] {
  return environments;
}

export function getActiveEnvironmentId(): string | null {
  return activeEnvironmentId;
}

export function getActiveEnvironment(): Environment | null {
  if (!activeEnvironmentId) return null;
  return environments.find((e) => e.uid === activeEnvironmentId) ?? null;
}

export function getDefaultEnvironmentId(): string | null {
  return defaultEnvironmentId;
}

export function getDefaultEnvironment(): Environment | null {
  if (!defaultEnvironmentId) return null;
  return environments.find((e) => e.uid === defaultEnvironmentId) ?? null;
}

export function getCollectionEnvOverrides(): Readonly<Record<string, string | null>> {
  return collectionEnvOverrides;
}

export function getManualEnvId(): string | null {
  return manualEnvId;
}

/**
 * The workspace this store's mirrors are currently hydrated for.
 * `null` before first hydration. Lets runtime-switch callers (the MCP
 * workspace tools) observe when the per-workspace swap has settled.
 */
export function getLoadedWorkspaceId(): string | null {
  return loadedWorkspaceId;
}

export function getWorkspaceVariables(): WorkspaceVariables {
  return workspaceVariables;
}

export function getVault(): Vault {
  return vault;
}

/**
 * True when the active workspace's vault is locked out — its persisted
 * ciphertext is present but undecryptable (the at-rest key was lost, WS-B
 * B2). {@link getVault} reads empty in that state; consumers must surface
 * this as "re-entry required" rather than treating the vault as empty.
 * Reads through the active {@link VaultCache} (the guarded hydrate sets the
 * flag); `false` when no active cache is materialized.
 */
export function isVaultLocked(): boolean {
  return getActiveCacheForRegistration<VaultCache>(VAULT_REGISTRATION)?.isVaultLocked() ?? false;
}

// ── Per-workspace accessors (MWPT-FULL session #19) ────────────────
//
// SW-internal consumers operating on a non-Active workspace (live-
// refresh chain executor, scheduler) read through the per-workspace
// caches rather than the Active-bound module-level mirror. Returns
// empty / null when no service is materialized for the workspace —
// the chain dispatch fails cleanly upstream.

export function getEnvironmentsForWorkspace(workspaceId: string): Environment[] {
  const cache = getCacheForWorkspace<EnvironmentCache>(ENVIRONMENT_REGISTRATION, workspaceId);
  return cache ? cache.getEnvironments() : [];
}

export function getVaultForWorkspace(workspaceId: string): Vault {
  const cache = getCacheForWorkspace<VaultCache>(VAULT_REGISTRATION, workspaceId);
  return cache ? cache.getVault() : { schemaVersion: 5, secrets: [] };
}

/** Per-workspace {@link isVaultLocked}; `false` when no cache is materialized. */
export function isVaultLockedForWorkspace(workspaceId: string): boolean {
  const cache = getCacheForWorkspace<VaultCache>(VAULT_REGISTRATION, workspaceId);
  return cache?.isVaultLocked() ?? false;
}

export function getWorkspaceVariablesForWorkspace(workspaceId: string): WorkspaceVariables {
  const cache = getCacheForWorkspace<WorkspaceVariablesCache>(WORKSPACE_VARIABLES_REGISTRATION, workspaceId);
  return cache ? cache.getWorkspaceVariables() : { schemaVersion: 5, variables: [] };
}

/**
 * Read the persisted default-environment pointer for an explicit
 * workspace. Falls back to a one-shot `chrome.storage.local` read for
 * non-Active workspaces — neither EnvironmentCache nor any other cache
 * tracks the pointer (it's a singleton scalar, not an entity slot).
 * Returns null on read failure or when the persisted value isn't a
 * string.
 */
export async function getDefaultEnvironmentIdForWorkspace(workspaceId: string): Promise<string | null> {
  const v = await hostStorage.get(wsKeys(workspaceId).defaultEnvironmentId);
  return typeof v === 'string' ? v : null;
}

// ── Environments CRUD ──────────────────────────────────────────────

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('EnvironmentStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

export function createEnvironment(name: string, variables: Variable[] = []): Environment {
  const env: Environment = {
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
export type EnvironmentWriteResult = { ok: true; environment: Environment } | { ok: false; reason: 'not-found' };

export async function renameEnvironment(uid: string, name: string): Promise<EnvironmentWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'environment', uid),
    async () => {
      const idx = environments.findIndex((e) => e.uid === uid);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const existing = environments[idx];
      const updated: Environment = {
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

export async function updateEnvironmentVariables(uid: string, variables: Variable[]): Promise<EnvironmentWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'environment', uid),
    async () => {
      const idx = environments.findIndex((e) => e.uid === uid);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const existing = environments[idx];
      const updated: Environment = { ...existing, variables };
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
        await hostStorage.set(wsKeys(workspaceId).collectionEnvOverrides, collectionEnvOverrides);
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

// Pointer setters were retired with BC-MWPT-FULL-10: pointer state
// (active / default / manual env, collection-env-overrides) is now
// per-workspace, written directly to `wsKeys(ws).<key>` by every
// surface (workbench tab + system surfaces alike). The SW's
// `bindActivePointerSubscriptions` watches the runtime-Active
// workspace's pointer keys and applies side-effects (DNR recompile,
// resolver invalidate, live-refresh switch-warm) on every write —
// regardless of which surface authored it. Stale ids are reconciled
// SW-side and written back so the stored value never drifts.
//
// `deleteEnvironment` (legacy SW handler) handles its own pointer
// cascade inline because the env-list mutation and pointer clears
// must be atomic against the in-memory copy; the storage subscription
// then no-ops the persist (`reconciled === activeEnvironmentId`).

function reconcileOverrides(
  overrides: Record<string, string | null>,
  envs: Environment[],
): Record<string, string | null> {
  const known = new Set(envs.map((e) => e.uid));
  const result: Record<string, string | null> = {};
  for (const [cid, envId] of Object.entries(overrides)) {
    if (envId === null || known.has(envId)) result[cid] = envId;
  }
  return result;
}

function overridesEqual(a: Record<string, string | null>, b: Record<string, string | null>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!(k in b)) return false;
    if (a[k] !== b[k]) return false;
  }
  return true;
}

// ── External pointer-write subscription ─────────────────────────────
//
// The runtime-Active workspace's pointer keys
// (`wsKeys(ws).{activeEnvironmentId, defaultEnvironmentId, manualEnvId,
// collectionEnvOverrides}`) are written directly by workbench surfaces
// editing this workspace — both the legacy (no-override) branch and
// the override branch use `hostStorage.set` as the canonical
// writer. The SW must observe those external writes and apply the
// same in-memory + side-effect cascade it would for an internal call,
// so DNR / resolver / live-refresh stay coherent. Stale ids are
// reconciled against the current env list and written back so the
// stored value never drifts.
//
// Re-bound on hydrate / switch — the subscription always tracks the
// SW's loaded workspace, never a non-active one.

let pointerSubscriptionsUnsubscribe: (() => void) | null = null;

function bindActivePointerSubscriptions(workspaceId: string): void {
  if (pointerSubscriptionsUnsubscribe) {
    pointerSubscriptionsUnsubscribe();
    pointerSubscriptionsUnsubscribe = null;
  }
  const keys = wsKeys(workspaceId);
  const disposers: Array<() => void> = [];

  disposers.push(
    hostStorage.subscribe(keys.activeEnvironmentId, (next) => {
      const incoming = typeof next === 'string' ? next : null;
      const reconciled = reconcilePointer(incoming, environments);
      if (reconciled === activeEnvironmentId) return;
      const prev = activeEnvironmentId;
      activeEnvironmentId = reconciled;
      if (reconciled !== incoming) {
        // Caller wrote a stale id; correct the stored value so the
        // workbench surface sees the reconciliation in its mirror.
        void hostStorage.set(keys.activeEnvironmentId, reconciled);
      }
      notifyActiveChange(reconciled, prev);
      notifyChange();
    }),
  );

  disposers.push(
    hostStorage.subscribe(keys.defaultEnvironmentId, (next) => {
      const incoming = typeof next === 'string' ? next : null;
      const reconciled = reconcilePointer(incoming, environments);
      if (reconciled === defaultEnvironmentId) return;
      defaultEnvironmentId = reconciled;
      if (reconciled !== incoming) {
        void hostStorage.set(keys.defaultEnvironmentId, reconciled);
      }
      notifyChange();
    }),
  );

  disposers.push(
    hostStorage.subscribe(keys.manualEnvId, (next) => {
      const incoming = typeof next === 'string' ? next : null;
      const reconciled = reconcilePointer(incoming, environments);
      if (reconciled === manualEnvId) return;
      manualEnvId = reconciled;
      if (reconciled !== incoming) {
        void hostStorage.set(keys.manualEnvId, reconciled);
      }
      notifyChange();
    }),
  );

  disposers.push(
    hostStorage.subscribe(keys.collectionEnvOverrides, (next) => {
      const incoming: Record<string, string | null> =
        next !== null && next !== undefined && typeof next === 'object' && !Array.isArray(next)
          ? (next as Record<string, string | null>)
          : {};
      const reconciled = reconcileOverrides(incoming, environments);
      if (overridesEqual(reconciled, collectionEnvOverrides)) return;
      collectionEnvOverrides = reconciled;
      if (!overridesEqual(reconciled, incoming)) {
        void hostStorage.set(keys.collectionEnvOverrides, reconciled);
      }
      notifyChange();
    }),
  );

  pointerSubscriptionsUnsubscribe = () => {
    for (const d of disposers) d();
  };
}

// ── Persistence ─────────────────────────────────────────────────────

async function persistEnvironments(): Promise<void> {
  const workspaceId = assertLoaded();
  await hostStorage.set(wsKeys(workspaceId).environments, environments);
  logger.debug('EnvironmentStore', `Persisted ${environments.length} envs (ws=${workspaceId})`);
  notifyChange();
}

async function persistActiveEnvironment(): Promise<void> {
  const workspaceId = assertLoaded();
  await hostStorage.set(wsKeys(workspaceId).activeEnvironmentId, activeEnvironmentId);
  notifyChange();
}

async function persistDefaultEnvironment(): Promise<void> {
  const workspaceId = assertLoaded();
  await hostStorage.set(wsKeys(workspaceId).defaultEnvironmentId, defaultEnvironmentId);
  notifyChange();
}

async function persistManualEnvId(): Promise<void> {
  const workspaceId = assertLoaded();
  await hostStorage.set(wsKeys(workspaceId).manualEnvId, manualEnvId);
  notifyChange();
}

// ── Hydration / workspace switch ───────────────────────────────────

interface WorkspaceSnapshot {
  environments: Environment[];
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
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
    hostStorage.getValidatedArray(keys.environments, EnvironmentSchema, {
      onError: drift(keys.environments.key),
    }),
    hostStorage.get(keys.activeEnvironmentId),
    hostStorage.get(keys.defaultEnvironmentId),
    hostStorage.getValidated(keys.workspaceVars, WorkspaceVariablesSchema, {
      onError: drift(keys.workspaceVars.key),
    }),
    hostStorage.getValidated(keys.vault, VaultSchema, { onError: vaultDrift }),
    hostStorage.get(keys.collectionEnvOverrides),
    hostStorage.get(keys.manualEnvId),
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
function reconcilePointer(persisted: string | null, envs: Environment[]): string | null {
  return persisted && envs.some((e) => e.uid === persisted) ? persisted : null;
}

export async function hydrateEnvironmentsFromStorage(): Promise<void> {
  const workspaceId = requireActiveWorkspaceId();
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  environments = snapshot.environments;
  activeEnvironmentId = reconcilePointer(snapshot.activeEnvironmentId, environments);
  defaultEnvironmentId = reconcilePointer(snapshot.defaultEnvironmentId, environments);
  workspaceVariables = snapshot.workspaceVariables;
  vault = snapshot.vault;
  collectionEnvOverrides = reconcileOverrides(snapshot.collectionEnvOverrides, environments);
  manualEnvId = reconcilePointer(snapshot.manualEnvId, environments);
  loadedWorkspaceId = workspaceId;
  bindActivePointerSubscriptions(workspaceId);
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
  bindActivePointerSubscriptions(workspaceId);
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
  await hostStorage.remove([
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
  if (pointerSubscriptionsUnsubscribe) {
    pointerSubscriptionsUnsubscribe();
    pointerSubscriptionsUnsubscribe = null;
  }
}
