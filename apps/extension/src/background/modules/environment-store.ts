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
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { driftRecorder } from './storage-drift';
import { getActiveWorkspaceId } from './workspace-store';

// ── In-memory state ─────────────────────────────────────────────────

let environments: V5.Environment[] = [];
let activeEnvironmentId: string | null = null;
let defaultEnvironmentId: string | null = null;
// Workspace-scoped singletons — both start at `version: 1` just like a
// freshly-created persisted entity. The counter advances on every
// SW-side write (see `setWorkspaceVariables` / `setVault`).
let workspaceVariables: V5.WorkspaceVariables = { schemaVersion: 5, version: 1, variables: [] };
let vault: V5.Vault = { schemaVersion: 5, version: 1, secrets: [] };
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
    version: 1,
    uid: generateUid(),
    name: name.trim() || 'Untitled Environment',
    variables,
  };
  environments = [...environments, env];
  void persistEnvironments();
  return env;
}

/**
 * Outcome of a versioned environment write (Phase 10 stale-draft
 * contract — parallel to `RuleWriteResult`).
 */
export type EnvironmentWriteResult =
  | { ok: true; version: number; environment: V5.Environment }
  | { ok: false; reason: 'stale-draft'; serverVersion: number; serverEnvironment: V5.Environment }
  | { ok: false; reason: 'not-found' };

export interface EnvironmentUpdateOptions {
  /**
   * Version the client loaded. Omit to opt out of stale-draft
   * detection — used by call sites that don't track a version
   * (sidebar rename, context-menu actions, bulk external imports).
   * The lock still serializes writes; without the check these are
   * last-write-wins.
   */
  expectedVersion?: number;
}

function environmentVersionOf(env: V5.Environment): number {
  return env.version;
}

export async function renameEnvironment(
  uid: string,
  name: string,
  options: EnvironmentUpdateOptions = {},
): Promise<EnvironmentWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'environment', uid),
    async () => {
      const idx = environments.findIndex((e) => e.uid === uid);
      if (idx === -1) return { ok: false, reason: 'not-found' } as EnvironmentWriteResult;
      const existing = environments[idx];
      const current = environmentVersionOf(existing);
      if (options.expectedVersion !== undefined && options.expectedVersion !== current) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: current,
          serverEnvironment: existing,
        } as EnvironmentWriteResult;
      }
      const nextVersion = current + 1;
      const updated: V5.Environment = {
        ...existing,
        name: name.trim() || existing.name,
        version: nextVersion,
      };
      environments = [...environments.slice(0, idx), updated, ...environments.slice(idx + 1)];
      await persistEnvironments();
      return { ok: true, version: nextVersion, environment: updated } as EnvironmentWriteResult;
    },
    { op: 'environment-rename' },
  );
}

export async function updateEnvironmentVariables(
  uid: string,
  variables: V5.Variable[],
  options: EnvironmentUpdateOptions = {},
): Promise<EnvironmentWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'environment', uid),
    async () => {
      const idx = environments.findIndex((e) => e.uid === uid);
      if (idx === -1) return { ok: false, reason: 'not-found' } as EnvironmentWriteResult;
      const existing = environments[idx];
      const current = environmentVersionOf(existing);
      if (options.expectedVersion !== undefined && options.expectedVersion !== current) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: current,
          serverEnvironment: existing,
        } as EnvironmentWriteResult;
      }
      const nextVersion = current + 1;
      const updated: V5.Environment = { ...existing, variables, version: nextVersion };
      environments = [...environments.slice(0, idx), updated, ...environments.slice(idx + 1)];
      await persistEnvironments();
      return { ok: true, version: nextVersion, environment: updated } as EnvironmentWriteResult;
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

// ── Workspace variables ────────────────────────────────────────────

/**
 * Outcome of a versioned workspace-scoped write (Phase 10 stale-draft
 * contract). Workspace-variables + vault are singletons per workspace,
 * so the "not-found" case of the multi-entity contract is absent —
 * the blob always exists (init on hydrate).
 */
export type WorkspaceVariablesWriteResult =
  | { ok: true; version: number; workspaceVariables: V5.WorkspaceVariables }
  | { ok: false; reason: 'stale-draft'; serverVersion: number; serverWorkspaceVariables: V5.WorkspaceVariables };

export type VaultWriteResult =
  | { ok: true; version: number; vault: V5.Vault }
  | { ok: false; reason: 'stale-draft'; serverVersion: number; serverVault: V5.Vault };

export interface SingletonUpdateOptions {
  expectedVersion?: number;
}

export async function setWorkspaceVariables(
  next: Omit<V5.WorkspaceVariables, 'schemaVersion' | 'version'> & { schemaVersion?: number },
  options: SingletonUpdateOptions = {},
): Promise<WorkspaceVariablesWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'workspace-vars', 'singleton'),
    async () => {
      const current = workspaceVariables.version;
      if (options.expectedVersion !== undefined && options.expectedVersion !== current) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: current,
          serverWorkspaceVariables: workspaceVariables,
        } as WorkspaceVariablesWriteResult;
      }
      const nextVersion = current + 1;
      workspaceVariables = {
        schemaVersion: 5,
        version: nextVersion,
        variables: next.variables,
      };
      await persistWorkspaceVariables();
      return { ok: true, version: nextVersion, workspaceVariables } as WorkspaceVariablesWriteResult;
    },
    { op: 'workspace-vars-set' },
  );
}

// ── Vault (secrets) ────────────────────────────────────────────────

export async function setVault(
  next: Omit<V5.Vault, 'schemaVersion' | 'version'> & { schemaVersion?: number },
  options: SingletonUpdateOptions = {},
): Promise<VaultWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'vault', 'singleton'),
    async () => {
      const current = vault.version;
      if (options.expectedVersion !== undefined && options.expectedVersion !== current) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: current,
          serverVault: vault,
        } as VaultWriteResult;
      }
      const nextVersion = current + 1;
      vault = {
        schemaVersion: 5,
        version: nextVersion,
        secrets: next.secrets,
      };
      await persistVault();
      return { ok: true, version: nextVersion, vault } as VaultWriteResult;
    },
    { op: 'vault-set' },
  );
}

/**
 * Per-key vault mutators. These share the same lock + version counter
 * as `setVault` so the Vault interface (ChromeStorageVault in the
 * renderer) can manage individual secrets without racing the bulk
 * editor path (VaultEditor → setVault). One writer, one lock, one
 * version counter — no silent drift between the two APIs.
 *
 * `expectedVersion` is optional here: per-key callers (OAuth token
 * refresh, API-key features) don't track the vault version at the
 * call site. The lock still serializes writes, so last-write-wins is
 * the documented semantics and is race-free (vs. the pre-Phase-10
 * bypass which had a read-modify-write race against direct storage).
 */
export async function putVaultSecret(key: string, value: string): Promise<VaultWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'vault', 'singleton'),
    async () => {
      const nextVersion = vault.version + 1;
      const idx = vault.secrets.findIndex((s) => s.name === key);
      // Per-key writers (OAuth refresh, API-key flows) only ever
      // produce string-kind entries — TOTP entries are managed via
      // the bulk `setVault` editor path. If a TOTP entry of the same
      // name already exists, the put OVERWRITES it with a string
      // entry; that's a deliberate, name-collision contract since
      // there is one namespace per vault.
      const next: V5.VaultSecret = { kind: 'string', name: key, value };
      const nextSecrets =
        idx >= 0 ? [...vault.secrets.slice(0, idx), next, ...vault.secrets.slice(idx + 1)] : [...vault.secrets, next];
      vault = { schemaVersion: 5, version: nextVersion, secrets: nextSecrets };
      await persistVault();
      return { ok: true, version: nextVersion, vault } as VaultWriteResult;
    },
    { op: 'vault-put-secret' },
  );
}

export async function deleteVaultSecret(key: string): Promise<VaultWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'vault', 'singleton'),
    async () => {
      const before = vault.secrets.length;
      const nextSecrets = vault.secrets.filter((s) => s.name !== key);
      // No-op when the key was already absent — still return ok so
      // callers treat idempotent deletes uniformly. Don't advance the
      // version counter if nothing actually changed (keeps triage
      // clean for "is the vault being thrashed?" investigations).
      if (nextSecrets.length === before) {
        return { ok: true, version: vault.version, vault } as VaultWriteResult;
      }
      const nextVersion = vault.version + 1;
      vault = { schemaVersion: 5, version: nextVersion, secrets: nextSecrets };
      await persistVault();
      return { ok: true, version: nextVersion, vault } as VaultWriteResult;
    },
    { op: 'vault-delete-secret' },
  );
}

/**
 * Read a single secret by name from the SW's in-memory snapshot. No
 * lock needed — reads are consistent by default (JS is single-
 * threaded inside the SW, and the SW's vault snapshot is the write
 * target). Returns null if the key isn't present, or if the entry is
 * a TOTP-kind secret — per-key callers (OAuth refresh, generic API)
 * read literal strings only; TOTP codes go through the request
 * executor's TotpRegistry instead.
 */
export function getVaultSecret(key: string): string | null {
  const found = vault.secrets.find((s) => s.name === key);
  if (!found || found.kind !== 'string') return null;
  return found.value;
}

/** Read all secret names from the SW's in-memory snapshot. */
export function listVaultSecretNames(): string[] {
  return vault.secrets.map((s) => s.name);
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

async function persistWorkspaceVariables(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).workspaceVars, workspaceVariables);
  notifyChange();
}

async function persistVault(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).vault, vault);
  notifyChange();
}

// ── Hydration / workspace switch ───────────────────────────────────

interface WorkspaceSnapshot {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
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

  const [environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault] = await Promise.all([
    extensionStorage.getValidatedArray(keys.environments, EnvironmentSchema, { onError: drift(keys.environments.key) }),
    extensionStorage.get(keys.activeEnvironmentId),
    extensionStorage.get(keys.defaultEnvironmentId),
    extensionStorage.getValidated(keys.workspaceVars, WorkspaceVariablesSchema, {
      onError: drift(keys.workspaceVars.key),
    }),
    extensionStorage.getValidated(keys.vault, VaultSchema, { onError: vaultDrift }),
  ]);

  return {
    environments,
    activeEnvironmentId: typeof activeEnvironmentId === 'string' ? activeEnvironmentId : null,
    defaultEnvironmentId: typeof defaultEnvironmentId === 'string' ? defaultEnvironmentId : null,
    workspaceVariables: workspaceVariables ?? { schemaVersion: 5, version: 1, variables: [] },
    vault: vault ?? { schemaVersion: 5, version: 1, secrets: [] },
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
  ]);
}

// ── Test helpers ───────────────────────────────────────────────────

export function __resetForTests(): void {
  environments = [];
  activeEnvironmentId = null;
  defaultEnvironmentId = null;
  workspaceVariables = { schemaVersion: 5, version: 1, variables: [] };
  vault = { schemaVersion: 5, version: 1, secrets: [] };
  loadedWorkspaceId = null;
  listeners.clear();
}
