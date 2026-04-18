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
import { extensionStorage, wsKeys } from '@/shared/storage';
import { driftRecorder } from './storage-drift';
import { getActiveWorkspaceId } from './workspace-store';

// ── In-memory state ─────────────────────────────────────────────────

let environments: V5.Environment[] = [];
let activeEnvironmentId: string | null = null;
let defaultEnvironmentId: string | null = null;
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
    uid: generateUid(),
    name: name.trim() || 'Untitled Environment',
    variables,
  };
  environments = [...environments, env];
  void persistEnvironments();
  return env;
}

export function renameEnvironment(uid: string, name: string): boolean {
  const idx = environments.findIndex((e) => e.uid === uid);
  if (idx === -1) return false;
  environments = [
    ...environments.slice(0, idx),
    { ...environments[idx], name: name.trim() || environments[idx].name },
    ...environments.slice(idx + 1),
  ];
  void persistEnvironments();
  return true;
}

export function updateEnvironmentVariables(uid: string, variables: V5.Variable[]): boolean {
  const idx = environments.findIndex((e) => e.uid === uid);
  if (idx === -1) return false;
  environments = [...environments.slice(0, idx), { ...environments[idx], variables }, ...environments.slice(idx + 1)];
  void persistEnvironments();
  return true;
}

export function deleteEnvironment(uid: string): boolean {
  const before = environments.length;
  environments = environments.filter((e) => e.uid !== uid);
  if (environments.length === before) return false;
  if (activeEnvironmentId === uid) {
    activeEnvironmentId = null;
    void persistActiveEnvironment();
  }
  if (defaultEnvironmentId === uid) {
    defaultEnvironmentId = null;
    void persistDefaultEnvironment();
  }
  void persistEnvironments();
  return true;
}

/**
 * Set the active environment, or clear it (null = "No environment",
 * Postman semantics). No-op if the id is invalid.
 */
export async function setActiveEnvironment(uid: string | null): Promise<boolean> {
  if (uid !== null && !environments.some((e) => e.uid === uid)) return false;
  if (activeEnvironmentId === uid) return true;
  activeEnvironmentId = uid;
  await persistActiveEnvironment();
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

export function setWorkspaceVariables(vars: V5.WorkspaceVariables): void {
  workspaceVariables = vars;
  void persistWorkspaceVariables();
}

// ── Vault (secrets) ────────────────────────────────────────────────

export function setVault(next: V5.Vault): void {
  vault = next;
  void persistVault();
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

  const [environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault] = await Promise.all([
    extensionStorage.getValidatedArray(keys.environments, EnvironmentSchema, { onError: drift(keys.environments.key) }),
    extensionStorage.get(keys.activeEnvironmentId),
    extensionStorage.get(keys.defaultEnvironmentId),
    extensionStorage.getValidated(keys.workspaceVars, WorkspaceVariablesSchema, {
      onError: drift(keys.workspaceVars.key),
    }),
    extensionStorage.getValidated(keys.vault, VaultSchema, { onError: drift(keys.vault.key) }),
  ]);

  return {
    environments,
    activeEnvironmentId: typeof activeEnvironmentId === 'string' ? activeEnvironmentId : null,
    defaultEnvironmentId: typeof defaultEnvironmentId === 'string' ? defaultEnvironmentId : null,
    workspaceVariables: workspaceVariables ?? { schemaVersion: 5, variables: [] },
    vault: vault ?? { schemaVersion: 5, secrets: [] },
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
  workspaceVariables = { schemaVersion: 5, variables: [] };
  vault = { schemaVersion: 5, secrets: [] };
  loadedWorkspaceId = null;
  listeners.clear();
}
