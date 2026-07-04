/**
 * RequestBodyQuickEditor — the request-body plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Matched Rules panel
 * (or any fired-rule hover) on a request-body rule that fired for the
 * inspected request. Static bodies only — dynamic (JavaScript) bodies
 * fall back to the workbench link, mirroring `ResponseQuickEditor`.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { RequestBodyRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { App, Tag, theme } from 'antd';
import { useMemo } from 'react';
import { buildRequestBodyRuleUpdate, type RequestBodyQuickEditDraft } from '../../data/rule-create/quick-rule-edit';
import { findRuleCollectionId } from '../../data/rule-create/rule-collection';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

export interface RequestBodyQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function RequestBodyQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: RequestBodyQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const bodyRule: RequestBodyRule | null = liveRule.type === 'request-body' ? liveRule : null;
  const isDynamic = bodyRule?.action.bodyType === 'dynamic';
  const editable = !!bodyRule && !isDynamic;

  const { localCollections } = useRules();
  const collectionId = useMemo(
    () => findRuleCollectionId(liveRule, localCollections),
    [liveRule, localCollections],
  );

  const canonical = useMemo<RequestBodyQuickEditDraft | null>(
    () => (bodyRule && !isDynamic ? { requestBody: bodyRule.action.requestBody } : null),
    [bodyRule, isDynamic],
  );
  const { draft, draftRef, updateDraft, isDirty: fieldDirty } = useActionDraft({ canonical });

  const condDraft = useConditionsDraft({ canonical: editable ? (bodyRule?.conditions ?? null) : null });
  const isDirty = fieldDirty || condDraft.isDirty;

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: editable && bodyRule ? bodyRule.uid : null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      bodyRule
        ? buildRequestBodyRuleUpdate(
            bodyRule,
            draftRef.current,
            condDraft.isDirty ? condDraft.conditionsRef.current : undefined,
          )
        : {},
    isDirty,
    editable,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void openWorkspace({ kind: 'edit-rule', uid: liveRule.uid }, 'devpanel').then(() => onClose());
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    marginBottom: 2,
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={liveRule}
      ruleType={liveRule.type}
      ruleName={liveRule.name}
      liveRuleUid={liveRule.uid}
      isDirty={isDirty}
      tags={
        bodyRule?.action.resourceType === 'graphql' ? (
          <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} color="purple">
            GraphQL
          </Tag>
        ) : undefined
      }
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
          <div style={fieldLabelStyle}>Request Body</div>
          <EntityField path={RULE_FIELD.requestBody}>
            <TemplateInput
              multiline
              maxRows={12}
              resizable
              allowClear
              value={draft.requestBody ?? ''}
              onChange={(v) => updateDraft({ requestBody: v })}
              placeholder={'{"query": "…", "variables": {}}'}
              suggestionContext={{ collectionId }}
              style={{
                width: '100%',
                minHeight: 120,
                fontFamily: token.fontFamilyCode,
                fontSize: 12,
              }}
            />
          </EntityField>
          <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
            Matching requests are sent with this body instead of the page's.
          </div>
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {bodyRule
            ? 'This rule builds its body with JavaScript. Open in workspace to edit the script.'
            : 'Open in workspace to inspect or change this rule.'}
        </div>
      )}
    </QuickEditorShell>
  );
}
