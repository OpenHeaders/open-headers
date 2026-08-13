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

import type { TelemetryRuleCreatedOrigin } from '@openheaders/core/telemetry';
import type { RuleSeed } from '@openheaders/core/utils';
import {
  applyRuleCreate,
  applyRuleDelete,
  applyRulePublish,
  applyRuleToggle,
  applyRuleUpdate,
  type RuleMutationResult,
  type RuleSimpleResult,
  type RuleUpdates,
} from '@openheaders/ui/shared/sync/rule-write-client';
import { useMemo } from 'react';
import { useGuardedMutation } from './use-guarded-mutation';

export type { RuleMutationResult, RuleSimpleResult, RuleUpdates };

export interface UseRuleMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
  /** `rule_created` origin attribution for creates minted through this
   *  mutator (plan §3, S16); omitted = the write client's `editor` default. */
  createOrigin?: TelemetryRuleCreatedOrigin;
}

export interface UseRuleMutatorApi {
  /** Mint a new rule entity (starts `published: false`). */
  createRule(rule: RuleSeed, parentPath: string): Promise<RuleMutationResult>;
  /** Promote a draft rule to live state (the publication gesture). */
  publishRule(ruleUid: string): Promise<RuleSimpleResult>;
  updateRule(ruleUid: string, updates: RuleUpdates): Promise<RuleMutationResult>;
  toggleRule(ruleUid: string, enabled: boolean): Promise<RuleSimpleResult>;
  deleteRule(ruleUid: string): Promise<RuleSimpleResult>;
}

export function useRuleMutator(opts: UseRuleMutatorOptions): UseRuleMutatorApi {
  const { workspaceId, surfaceId, createOrigin } = opts;

  const createRule = useGuardedMutation(workspaceId, surfaceId, (writeOpts, rule: RuleSeed, parentPath: string) =>
    applyRuleCreate({ rule, parentPath }, createOrigin ? { ...writeOpts, origin: createOrigin } : writeOpts),
  );

  const publishRule = useGuardedMutation(workspaceId, surfaceId, (writeOpts, ruleUid: string) =>
    applyRulePublish(ruleUid, writeOpts),
  );

  const updateRule = useGuardedMutation(workspaceId, surfaceId, (writeOpts, ruleUid: string, updates: RuleUpdates) =>
    applyRuleUpdate(ruleUid, updates, writeOpts),
  );

  const toggleRule = useGuardedMutation(workspaceId, surfaceId, (writeOpts, ruleUid: string, enabled: boolean) =>
    applyRuleToggle(ruleUid, enabled, writeOpts),
  );

  const deleteRule = useGuardedMutation(workspaceId, surfaceId, (writeOpts, ruleUid: string) =>
    applyRuleDelete(ruleUid, writeOpts),
  );

  return useMemo(
    () => ({ createRule, publishRule, updateRule, toggleRule, deleteRule }),
    [createRule, publishRule, updateRule, toggleRule, deleteRule],
  );
}
