/**
 * Save dispatch for `VariableHoverPopover`.
 *
 * `runUpdate` / `runCreate` splice the new value into the popover's
 * own data snapshot (sourced from `useEnvironments` / `useRules` in the
 * popover render) and call the mutator's pure `replace*` write methods.
 *
 * The popover and the mutator each call `useEnvironments` separately
 * — independent React state instances that hydrate via independent
 * post-mount effects. If we let the mutator do the read-modify-write
 * internally, it would race against the popover's view: the popover
 * might already see the variable while the mutator's view is still
 * the initial empty default, and the splice would write a list that
 * drops every other variable. Centralizing the read in the popover
 * (whose render we already gate on hydration) closes the race.
 */

import type {
  Collection,
  Environment,
  Variable,
  Vault,
  VaultSecret,
  WorkspaceVariables,
} from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { MutationResult, useVariableMutator } from '@openheaders/ui/shared/hooks/mutators/useVariableMutator';
import type { VariableCandidate } from '@openheaders/ui/shared/hooks/variables/useVariableLookup';
import type { App } from 'antd';
import type { CreateScope } from './variable-popover-create-flow';

export interface UpdateSnapshot {
  environments: Environment[];
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
  localCollections: Collection[];
}

export interface CreateSnapshot {
  activeEnvironment: Environment | null;
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
  localCollections: Collection[];
  collectionId?: string;
}

export async function runUpdate(
  mutator: ReturnType<typeof useVariableMutator>,
  c: VariableCandidate,
  draft: string,
  snap: UpdateSnapshot,
): Promise<MutationResult> {
  switch (c.scope) {
    case 'vault': {
      if (c.secret.kind !== 'string') {
        return { ok: false, reason: 'other', message: 'TOTP secrets must be edited in the Vault editor' };
      }
      const idx = snap.vault.secrets.findIndex((s) => s.name === c.secret.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = snap.vault.secrets.slice();
      const target = next[idx];
      if (target.kind !== 'string') {
        return { ok: false, reason: 'other', message: 'Vault entry kind changed under us' };
      }
      next[idx] = { ...target, value: draft };
      return mutator.replaceVault(next);
    }
    case 'environment': {
      const env = snap.environments.find((e) => e.uid === c.envUid);
      if (!env) return { ok: false, reason: 'not-found' };
      const idx = env.variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = env.variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceEnvironmentVariables(env.uid, next);
    }
    case 'collection': {
      const collection = snap.localCollections.find((cc) => cc.uid === c.collectionUid);
      if (!collection) return { ok: false, reason: 'not-found' };
      const variables = collection.variables ?? [];
      const idx = variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceCollectionVariables(collection.uid, next);
    }
    case 'workspace': {
      const idx = snap.workspaceVariables.variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = snap.workspaceVariables.variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceWorkspaceVariables(next);
    }
    case 'live':
      return mutator.setLiveOverride(c.lv.uid, { value: draft });
    case 'step':
    case 'file':
    case 'dynamic':
      return { ok: false, reason: 'other', message: 'Not editable' };
  }
}

export async function runCreate(
  mutator: ReturnType<typeof useVariableMutator>,
  scope: CreateScope,
  name: string,
  value: string,
  snap: CreateSnapshot,
): Promise<MutationResult> {
  switch (scope) {
    case 'workspace': {
      if (snap.workspaceVariables.variables.some((v) => v.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: Variable[] = [
        ...snap.workspaceVariables.variables,
        { uid: generateUid(), name, value, type: 'default' },
      ];
      return mutator.replaceWorkspaceVariables(next);
    }
    case 'vault': {
      if (snap.vault.secrets.some((s) => s.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: VaultSecret[] = [...snap.vault.secrets, { uid: generateUid(), kind: 'string', name, value }];
      return mutator.replaceVault(next);
    }
    case 'environment': {
      const env = snap.activeEnvironment;
      if (!env) return { ok: false, reason: 'other', message: 'No active environment' };
      if (env.variables.some((v) => v.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: Variable[] = [...env.variables, { uid: generateUid(), name, value, type: 'default' }];
      return mutator.replaceEnvironmentVariables(env.uid, next);
    }
    case 'collection': {
      if (!snap.collectionId) return { ok: false, reason: 'other', message: 'No collection in context' };
      const collection = snap.localCollections.find((c) => c.uid === snap.collectionId);
      if (!collection) return { ok: false, reason: 'not-found' };
      const variables = collection.variables ?? [];
      if (variables.some((v) => v.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: Variable[] = [...variables, { uid: generateUid(), name, value, type: 'default' }];
      return mutator.replaceCollectionVariables(collection.uid, next);
    }
  }
}

/** Map a {@link MutationResult} to AntD message + onSuccess callback.
 *  Centralized so all writes surface uniformly. */
export function surfaceResult(
  result: MutationResult,
  message: ReturnType<typeof App.useApp>['message'],
  onSuccess: () => void,
): void {
  if (result.ok) {
    message.success('Saved');
    onSuccess();
    return;
  }
  switch (result.reason) {
    case 'duplicate-name':
      message.error('A variable with that name already exists in this scope.');
      return;
    case 'not-found':
      message.error('Variable not found — it may have been deleted.');
      return;
    case 'other':
      message.error(result.message ?? 'Save failed');
      return;
  }
}
