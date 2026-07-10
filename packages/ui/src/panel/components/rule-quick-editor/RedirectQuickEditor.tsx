/**
 * RedirectQuickEditor — the redirect-rule plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Matched Rules panel
 * (or any fired-rule hover) on a redirect rule that fired for the
 * inspected request. Saving retargets the rule for FUTURE requests.
 *
 * Compact by design, mirroring `RedirectQuickCreate`: one template-aware
 * target field plus the shared Conditions row — everything else (regex
 * conditions, local-file targets) belongs to the workbench, reached via
 * the footer link.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { RedirectRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { DetectedValueInput } from '@openheaders/ui/workbench/components/value-editors';
import { App, Typography, theme } from 'antd';
import { useMemo } from 'react';
import { buildRedirectRuleUpdate, type RedirectQuickEditDraft } from '../../data/rule-create/redirect-rule-edit';
import { findRuleCollectionId } from '../../data/rule-create/rule-collection';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

const { Text } = Typography;

export interface RedirectQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function RedirectQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: RedirectQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  // Reactive live rule — subscribes to the rule sync mirror so commits
  // from any surface (workbench, popup, another devpanel) update the
  // popover; the static prop only seeds the first render.
  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const redirectRule: RedirectRule | null = liveRule.type === 'redirect' ? liveRule : null;

  // Collection that owns the rule — scopes the target's `{{collection.X}}`
  // suggestions, same derivation as the header popover.
  const { localCollections } = useRules();
  const collectionId = useMemo(
    () => findRuleCollectionId(liveRule, localCollections),
    [liveRule, localCollections],
  );
  const editable = !!redirectRule;

  const canonical = useMemo<RedirectQuickEditDraft | null>(
    () => (redirectRule ? { redirectTo: redirectRule.action.redirectTo } : null),
    [redirectRule],
  );
  const { draft, draftRef, updateDraft, isDirty: fieldDirty } = useActionDraft({ canonical });

  const condDraft = useConditionsDraft({ canonical: redirectRule?.conditions ?? null });
  const isDirty = fieldDirty || condDraft.isDirty;

  // A target that doesn't resolve gates Save — a published redirect with
  // an unresolvable template would silently never fire, the worst
  // outcome. The reference's create flow (hover the red token) lifts the
  // gate live. Same gate as `RedirectQuickCreate`.
  const resolver = useVariableResolver();
  const trimmedTarget = (draft.redirectTo ?? '').trim();
  const targetResolves = useMemo(() => {
    if (!trimmedTarget) return false;
    const context = collectionId ? { collectionId } : undefined;
    return resolver.resolveTemplate(trimmedTarget, context).errors.length === 0;
  }, [resolver, trimmedTarget, collectionId]);

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: redirectRule?.uid ?? null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      redirectRule
        ? buildRedirectRuleUpdate(
            redirectRule,
            draftRef.current,
            condDraft.isDirty ? condDraft.conditionsRef.current : undefined,
          )
        : {},
    isDirty,
    editable,
    valid: targetResolves,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void openWorkspace({ kind: 'edit-rule', uid: liveRule.uid }, 'devpanel').then(() => onClose());
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={liveRule}
      ruleType={liveRule.type}
      ruleName={liveRule.name}
      liveRuleUid={liveRule.uid}
      isDirty={isDirty}
      conditions={
        editable ? (
          <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
            <QuickConditionsRow value={condDraft.conditions} onChange={condDraft.setConditions} />
          </EntityScopeProvider>
        ) : undefined
      }
      onOpenInEditor={openInEditor}
      save={editable ? { saving, canSave, saveLabel, onSave: () => void handleSave() } : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      {editable ? (
        <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            Redirects to
          </Text>
          <div style={{ width: '100%', minWidth: 0 }}>
            <EntityField path={RULE_FIELD.redirectTo}>
              <DetectedValueInput
                editorVariant="compact"
                size="small"
                wrap
                maxRows={4}
                resizable
                allowClear
                value={draft.redirectTo ?? ''}
                onChange={(v) => updateDraft({ redirectTo: v })}
                placeholder="e.g. https://openheaders.io/redirected"
                suggestionContext={{ collectionId }}
                flagUnresolved
                style={{ width: '100%' }}
              />
            </EntityField>
          </div>
          {trimmedTarget && !targetResolves ? (
            <div style={{ marginTop: 6, fontSize: 11, color: token.colorWarning, lineHeight: 1.4 }}>
              Variable missing — hover the red reference to create it and enable Save.
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
              Matching requests are sent to this URL before they reach the network.
            </div>
          )}
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          Open in workspace to inspect or change this rule.
        </div>
      )}
    </QuickEditorShell>
  );
}
