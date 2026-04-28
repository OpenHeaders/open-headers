/**
 * useRuleMutator — write-only API for rule edits.
 *
 * The Phase-10 stale-draft path is gone (sync engine §24): rule writes
 * apply unconditionally and concurrent edits reconcile per-field via
 * HLC LWW + the awareness ribbon. The result discriminator therefore
 * collapses to `{ ok: true } | { ok: false; reason: 'not-found' | 'other' }`
 * — surfaces don't need a "stale-draft" branch any more.
 *
 * The write-only shape exists for the same race-avoidance reason as
 * `useVariableMutator`: each `useRules()` call is an INDEPENDENT React
 * state instance hydrating via its own post-mount effect. Doing
 * read-modify-write inside the mutator would race against the caller's
 * view; the caller passes its already-spliced patch and we forward.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { useCallback } from 'react';

export type RuleUpdates = Partial<Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>>;

export type RuleMutationResult =
  | { ok: true; rule: V5.Rule }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface UseRuleMutatorApi {
  /** Persist a rule patch. Resolves with a discriminated result. */
  updateRule(ruleUid: string, updates: RuleUpdates): Promise<RuleMutationResult>;
}

export function useRuleMutator(): UseRuleMutatorApi {
  const updateRule = useCallback<UseRuleMutatorApi['updateRule']>(async (ruleUid, updates) => {
    const resp = await call('updateLocalRule', { ruleId: ruleUid, updates }).catch((err: Error) => ({
      ok: false as const,
      reason: 'other' as const,
      message: err.message,
    }));

    if (resp.ok) return { ok: true, rule: resp.rule };
    if (resp.reason === 'not-found') return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'other', message: 'message' in resp ? resp.message : undefined };
  }, []);

  return { updateRule };
}
