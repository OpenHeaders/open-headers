/**
 * useRuleMutator — write-only API for rule edits.
 *
 * Thin React adapter over `rule-write-client.ts`.
 *
 * Sync engine §24 retired the `version` counter + stale-draft contract.
 * Concurrent edits reconcile per-field via HLC LWW + the awareness
 * ribbon; the result discriminator therefore collapses to
 * `{ ok: true } | { ok: false; reason: 'not-found' | 'other' }`.
 */

import { useMemo } from 'react';
import {
  applyRuleDelete,
  applyRuleToggle,
  applyRuleUpdate,
  type RuleMutationResult,
  type RuleSimpleResult,
  type RuleUpdates,
} from '@/shared/sync/rule-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { RuleMutationResult, RuleSimpleResult, RuleUpdates };

export interface UseRuleMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseRuleMutatorApi {
  updateRule(ruleUid: string, updates: RuleUpdates): Promise<RuleMutationResult>;
  toggleRule(ruleUid: string, enabled: boolean): Promise<RuleSimpleResult>;
  deleteRule(ruleUid: string): Promise<RuleSimpleResult>;
}

export function useRuleMutator(opts: UseRuleMutatorOptions): UseRuleMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateRule = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, ruleUid: string, updates: RuleUpdates) =>
      applyRuleUpdate(ruleUid, updates, writeOpts),
  );

  const toggleRule = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, ruleUid: string, enabled: boolean) =>
      applyRuleToggle(ruleUid, enabled, writeOpts),
  );

  const deleteRule = useGuardedMutation(workspaceId, surfaceId, (writeOpts, ruleUid: string) =>
    applyRuleDelete(ruleUid, writeOpts),
  );

  return useMemo(
    () => ({ updateRule, toggleRule, deleteRule }),
    [updateRule, toggleRule, deleteRule],
  );
}
