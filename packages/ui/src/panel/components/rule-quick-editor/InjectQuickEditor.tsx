/**
 * InjectQuickEditor — the inject-rule plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Matched Rules panel
 * (or any fired-rule hover) on an inject rule that fired for the
 * inspected page. Surfaces the one field the rule's code source uses —
 * the inline code (template-aware, like the body editors) or the
 * source URL (literal — URLs aren't template-resolved on this path).
 * Language, code source, position and CSP bypass stay in the workbench.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { InjectRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { App, Input, Tag, theme } from 'antd';
import { useMemo } from 'react';
import { buildInjectRuleUpdate, type InjectQuickEditDraft, seedInjectDraft } from '../../data/rule-create/quick-rule-edit';
import { findRuleCollectionId } from '../../data/rule-create/rule-collection';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

export interface InjectQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function InjectQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: InjectQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const injectRule: InjectRule | null = liveRule.type === 'inject' ? liveRule : null;
  const editable = !!injectRule;
  const urlSource = injectRule?.action.source === 'url';

  const { localCollections } = useRules();
  const collectionId = useMemo(
    () => findRuleCollectionId(liveRule, localCollections),
    [liveRule, localCollections],
  );

  const canonical = useMemo<InjectQuickEditDraft | null>(
    () => (injectRule ? seedInjectDraft(injectRule) : null),
    [injectRule],
  );
  const { draft, draftRef, updateDraft, isDirty: fieldDirty } = useActionDraft({ canonical });

  const condDraft = useConditionsDraft({ canonical: injectRule?.conditions ?? null });
  const isDirty = fieldDirty || condDraft.isDirty;

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: injectRule?.uid ?? null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      injectRule
        ? buildInjectRuleUpdate(
            injectRule,
            draftRef.current,
            condDraft.isDirty ? condDraft.conditionsRef.current : undefined,
          )
        : {},
    isDirty,
    editable,
    // An empty source URL saves a rule that injects nothing; empty
    // inline code is a legitimate blank-out.
    valid: !urlSource || !!(draft.sourceUrl ?? '').trim(),
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
        injectRule ? (
          <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} color={injectRule.action.injectType === 'css' ? 'geekblue' : 'gold'}>
            {injectRule.action.injectType === 'css' ? 'CSS' : 'JS'}
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
      {editable && urlSource ? (
        <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
          <div style={fieldLabelStyle}>Source URL</div>
          <EntityField path={RULE_FIELD.injectSourceUrl}>
            <Input
              size="small"
              allowClear
              value={draft.sourceUrl ?? ''}
              onChange={(e) => updateDraft({ sourceUrl: e.target.value })}
              placeholder="Enter Source URL (relative or absolute)"
              style={{ width: '100%' }}
            />
          </EntityField>
          <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
            Matching pages load this {injectRule.action.injectType === 'css' ? 'stylesheet' : 'script'} as they load.
          </div>
        </EntityScopeProvider>
      ) : editable ? (
        <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
          <div style={fieldLabelStyle}>Code</div>
          <EntityField path={RULE_FIELD.injectCode}>
            <TemplateInput
              multiline
              maxRows={12}
              resizable
              allowClear
              value={draft.code ?? ''}
              onChange={(v) => updateDraft({ code: v })}
              placeholder={injectRule.action.injectType === 'css' ? 'body { background: #fff; }' : 'console.log("…");'}
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
            Injected into matching pages as they load.
          </div>
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          Open in workspace to inspect or change this rule.
        </div>
      )}
    </QuickEditorShell>
  );
}
