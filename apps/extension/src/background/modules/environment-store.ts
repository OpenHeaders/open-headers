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
 *   - `oh.ws.<id>.workspaceVars`         → WorkspaceVariables
 *   - `oh.ws.<id>.vault`                 → Vault (local-per-device,
 *                                          never synced)
 *
 * "No environment" is a valid state (Postman semantics) — activeId
 * stays null. Variable resolution still works via workspace / collection
 * scopes.
 */

import type { V5 } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { storage } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { getActiveWorkspaceId } from './workspace-store';

// ── Storage keys ────────────────────────────────────────────────────

function environmentsKey(workspaceId: string): string {
  return `oh.ws.${workspaceId}.environments`;
}
function activeEnvironmentKey(workspaceId: string): string {
  return `oh.ws.${workspaceId}.activeEnvironmentId`;
}
function workspaceVarsKey(workspaceId: string): string {
  return `oh.ws.${workspaceId}.workspaceVars`;
}
function vaultKey(workspaceId: string): string {
  return `oh.ws.${workspaceId}.vault`;
}

// ── In-memory state ─────────────────────────────────────────────────

let environments: V5.Environment[] = [];
let activeEnvironmentId: string | null = null;
let workspaceVariables: V5.WorkspaceVariables = { variables: [] };
let vault: V5.Vault = { secrets: [] };
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
  environments = [
    ...environments.slice(0, idx),
    { ...environments[idx], variables },
    ...environments.slice(idx + 1),
  ];
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

function persistEnvironments(): Promise<void> {
  const workspaceId = assertLoaded();
  return new Promise((resolve) => {
    storage.local.set({ [environmentsKey(workspaceId)]: environments }, () => {
      logger.debug('EnvironmentStore', `Persisted ${environments.length} envs (ws=${workspaceId})`);
      notifyChange();
      resolve();
    });
  });
}

function persistActiveEnvironment(): Promise<void> {
  const workspaceId = assertLoaded();
  return new Promise((resolve) => {
    storage.local.set({ [activeEnvironmentKey(workspaceId)]: activeEnvironmentId }, () => {
      notifyChange();
      resolve();
    });
  });
}

function persistWorkspaceVariables(): Promise<void> {
  const workspaceId = assertLoaded();
  return new Promise((resolve) => {
    storage.local.set({ [workspaceVarsKey(workspaceId)]: workspaceVariables }, () => {
      notifyChange();
      resolve();
    });
  });
}

function persistVault(): Promise<void> {
  const workspaceId = assertLoaded();
  return new Promise((resolve) => {
    storage.local.set({ [vaultKey(workspaceId)]: vault }, () => {
      notifyChange();
      resolve();
    });
  });
}

// ── Hydration / workspace switch ───────────────────────────────────

interface WorkspaceSnapshot {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  return new Promise((resolve) => {
    storage.local.get(
      [
        environmentsKey(workspaceId),
        activeEnvironmentKey(workspaceId),
        workspaceVarsKey(workspaceId),
        vaultKey(workspaceId),
      ],
      (result: Record<string, unknown>) => {
        const storedEnvs = result[environmentsKey(workspaceId)];
        const storedActive = result[activeEnvironmentKey(workspaceId)];
        const storedVars = result[workspaceVarsKey(workspaceId)];
        const storedVault = result[vaultKey(workspaceId)];
        resolve({
          environments: Array.isArray(storedEnvs) ? (storedEnvs as V5.Environment[]) : [],
          activeEnvironmentId: typeof storedActive === 'string' ? storedActive : null,
          workspaceVariables:
            storedVars && typeof storedVars === 'object' && 'variables' in (storedVars as object)
              ? (storedVars as V5.WorkspaceVariables)
              : { variables: [] },
          vault:
            storedVault && typeof storedVault === 'object' && 'secrets' in (storedVault as object)
              ? (storedVault as V5.Vault)
              : { secrets: [] },
        });
      },
    );
  });
}

export async function hydrateEnvironmentsFromStorage(): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  environments = snapshot.environments;
  // Drop stale active-id if the environment no longer exists.
  activeEnvironmentId =
    snapshot.activeEnvironmentId && environments.some((e) => e.uid === snapshot.activeEnvironmentId)
      ? snapshot.activeEnvironmentId
      : null;
  workspaceVariables = snapshot.workspaceVariables;
  vault = snapshot.vault;
  loadedWorkspaceId = workspaceId;
  logger.info(
    'EnvironmentStore',
    `Hydrated ws=${workspaceId}: ${environments.length} envs, active=${activeEnvironmentId ?? 'none'}`,
  );
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  environments = snapshot.environments;
  activeEnvironmentId =
    snapshot.activeEnvironmentId && environments.some((e) => e.uid === snapshot.activeEnvironmentId)
      ? snapshot.activeEnvironmentId
      : null;
  workspaceVariables = snapshot.workspaceVariables;
  vault = snapshot.vault;
  loadedWorkspaceId = workspaceId;
  logger.info(
    'EnvironmentStore',
    `Switched to ws=${workspaceId}: ${environments.length} envs, active=${activeEnvironmentId ?? 'none'}`,
  );
  notifyChange();
}

/**
 * Drop every environment/vars/vault key for a workspace. Called on
 * workspace delete so the storage quota isn't bloated by orphan data.
 */
export async function purgeWorkspaceEnvironmentData(workspaceId: string): Promise<void> {
  await new Promise<void>((resolve) => {
    storage.local.remove(
      [environmentsKey(workspaceId), activeEnvironmentKey(workspaceId), workspaceVarsKey(workspaceId), vaultKey(workspaceId)],
      () => resolve(),
    );
  });
}

// ── Test helpers ───────────────────────────────────────────────────

export function __resetForTests(): void {
  environments = [];
  activeEnvironmentId = null;
  workspaceVariables = { variables: [] };
  vault = { secrets: [] };
  loadedWorkspaceId = null;
  listeners.clear();
}
