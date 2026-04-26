/**
 * useRuleMutator — write-only API for rule edits, mirroring
 * `useVariableMutator`.
 *
 * Callers (the inspector hover popover, future inline editors) read
 * the rule from THEIR OWN `useRules()` snapshot, build the next
 * `action`/`conditions` etc. against that snapshot, and pass the full
 * patch + the loaded `version` here. The hook persists via the
 * versioned bridge call and maps the bridge's `RuleWriteResult` shape
 * onto the same `MutationResult` discriminator the variable mutator
 * uses, so both popovers surface results uniformly.
 *
 * The write-only shape exists for the same race-avoidance reason as
 * `useVariableMutator`: each `useRules()` call is an INDEPENDENT
 * React state instance that hydrates via its own post-mount effect.
 * Doing read-modify-write inside the mutator would race against the
 * caller's view; by reading from the caller's snapshot we keep the
 * read and the splice on the same baseline.
 */

import type { MutationResult } from '@hooks/useVariableMutator';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { useCallback } from 'react';

export type RuleUpdates = Partial<Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion' | 'version'>>;

export interface UseRuleMutatorApi {
  /** Persist a rule patch with optional concurrent-edit protection.
   *  Pass the `version` that was loaded into the editor as
   *  `expectedVersion`; omit for last-write-wins (matches the
   *  unversioned entry point in `RuleContext.updateLocalRule`). */
  updateRule(ruleUid: string, updates: RuleUpdates, expectedVersion?: number): Promise<MutationResult>;
}

export function useRuleMutator(): UseRuleMutatorApi {
  const updateRule = useCallback<UseRuleMutatorApi['updateRule']>(async (ruleUid, updates, expectedVersion) => {
    const resp = await call('updateLocalRule', {
      ruleId: ruleUid,
      updates,
      ...(typeof expectedVersion === 'number' ? { expectedVersion } : {}),
    }).catch((err: Error) => ({ ok: false as const, reason: 'other' as const, message: err.message }));

    if (resp.ok) return { ok: true, version: resp.version };
    if (resp.reason === 'stale-draft') {
      return { ok: false, reason: 'stale-draft', serverVersion: resp.serverVersion };
    }
    if (resp.reason === 'not-found') return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'other', message: 'message' in resp ? resp.message : undefined };
  }, []);

  return { updateRule };
}
