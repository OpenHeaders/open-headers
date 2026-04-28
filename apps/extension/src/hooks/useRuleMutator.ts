/**
 * useRuleMutator — write-only API for rule edits.
 *
 * The hook is a thin React adapter over {@link applyRuleUpdate} /
 * {@link applyRuleToggle} / {@link applyRuleDelete}. It owns no React
 * state of its own — every memoised callback closes over the
 * `(workspaceId, surfaceId)` pair so a workspace switch produces a fresh
 * function reference and any in-flight envelope still carries the
 * workspace id it was minted under.
 *
 * Sync engine §24 retired the `version` counter + stale-draft contract.
 * Concurrent edits reconcile per-field via HLC LWW + the awareness
 * ribbon; the result discriminator therefore collapses to
 * `{ ok: true } | { ok: false; reason: 'not-found' | 'other' }`.
 */

import { useCallback, useMemo } from 'react';
import {
  applyRuleDelete,
  applyRuleToggle,
  applyRuleUpdate,
  type RuleMutationResult,
  type RuleSimpleResult,
  type RuleUpdates,
} from '@/shared/sync/rule-write-client';

export type { RuleMutationResult, RuleSimpleResult, RuleUpdates };

export interface UseRuleMutatorOptions {
  /** Active workspace id; envelopes mint with this on the wire. */
  workspaceId: string | null;
  /** Surface attribution carried on every emitted envelope. */
  surfaceId: string;
}

export interface UseRuleMutatorApi {
  updateRule(ruleUid: string, updates: RuleUpdates): Promise<RuleMutationResult>;
  toggleRule(ruleUid: string, enabled: boolean): Promise<RuleSimpleResult>;
  deleteRule(ruleUid: string): Promise<RuleSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useRuleMutator(opts: UseRuleMutatorOptions): UseRuleMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateRule = useCallback<UseRuleMutatorApi['updateRule']>(
    async (ruleUid, updates) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRuleUpdate(ruleUid, updates, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const toggleRule = useCallback<UseRuleMutatorApi['toggleRule']>(
    async (ruleUid, enabled) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRuleToggle(ruleUid, enabled, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteRule = useCallback<UseRuleMutatorApi['deleteRule']>(
    async (ruleUid) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRuleDelete(ruleUid, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(() => ({ updateRule, toggleRule, deleteRule }), [updateRule, toggleRule, deleteRule]);
}
