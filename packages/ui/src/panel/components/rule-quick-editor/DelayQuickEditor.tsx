/**
 * DelayQuickEditor — the delay-rule plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Matched Rules panel
 * (or any fired-rule hover) on a delay rule that fired for the
 * inspected request. Mirrors `DelayQuickCreate`'s single field.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { DelayRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { App, InputNumber, Typography, theme } from 'antd';
import { useMemo } from 'react';
import { buildDelayRuleUpdate, type DelayQuickEditDraft } from '../../data/rule-create/quick-rule-edit';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

const { Text } = Typography;

export interface DelayQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function DelayQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: DelayQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const delayRule: DelayRule | null = liveRule.type === 'delay' ? liveRule : null;
  const editable = !!delayRule;

  const canonical = useMemo<DelayQuickEditDraft | null>(
    () => (delayRule ? { delayMs: delayRule.action.delayMs } : null),
    [delayRule],
  );
  const { draft, draftRef, updateDraft, isDirty: fieldDirty } = useActionDraft({ canonical });

  const condDraft = useConditionsDraft({ canonical: delayRule?.conditions ?? null });
  const isDirty = fieldDirty || condDraft.isDirty;

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: delayRule?.uid ?? null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      delayRule
        ? buildDelayRuleUpdate(delayRule, draftRef.current, condDraft.isDirty ? condDraft.conditionsRef.current : undefined)
        : {},
    isDirty,
    editable,
    // min 1: a 0ms delay makes the rule a no-op (the compiler skips
    // `delayMs === 0`), so it would save but never fire.
    valid: draft.delayMs != null && draft.delayMs >= 1,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              {t('workbench.editors.rule.fields.delay.label')}
            </Text>
            <EntityField path={RULE_FIELD.delayMs}>
              <InputNumber
                size="small"
                min={1}
                max={30000}
                step={100}
                addonAfter="ms"
                style={{ width: 160 }}
                placeholder="1000"
                value={draft.delayMs}
                onChange={(v) => updateDraft({ delayMs: v })}
              />
            </EntityField>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('workbench.editors.rule.fields.delay.maxNote')}
            </Text>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
            {t('panel.quickEditor.delay.hint')}
          </div>
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {t('panel.quickEditor.openToInspect')}
        </div>
      )}
    </QuickEditorShell>
  );
}
