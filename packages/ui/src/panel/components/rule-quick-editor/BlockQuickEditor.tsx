/**
 * BlockQuickEditor — the block-rule plug-in body of the shared
 * `QuickEditorShell`. Edit mode: block has no action fields, so the
 * quick edit is conditions-only — retarget which requests get blocked
 * without a round-trip to the workbench.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { BlockRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { App, theme } from 'antd';
import { buildBlockRuleUpdate } from '../../data/rule-create/quick-rule-edit';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

export interface BlockQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function BlockQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: BlockQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const blockRule: BlockRule | null = liveRule.type === 'block' ? liveRule : null;
  const editable = !!blockRule;

  const condDraft = useConditionsDraft({ canonical: blockRule?.conditions ?? null });

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: blockRule?.uid ?? null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      blockRule ? buildBlockRuleUpdate(blockRule, condDraft.isDirty ? condDraft.conditionsRef.current : undefined) : {},
    isDirty: condDraft.isDirty,
    editable,
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
      isDirty={condDraft.isDirty}
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
      <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
        {editable
          ? 'Matching requests are blocked before they reach the network. Adjust the conditions below to retarget the rule.'
          : 'Open in workspace to inspect or change this rule.'}
      </div>
    </QuickEditorShell>
  );
}
