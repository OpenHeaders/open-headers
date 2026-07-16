/**
 * QueryParamQuickEditor — the query-param plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Matched Rules panel
 * (or any fired-rule hover) on a query-param rule that fired for the
 * inspected request. Rows shared with create mode via
 * `QueryParamQuickRows`; entry uids carry through the edit so row
 * identity is preserved.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { QueryParamRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { App, theme } from 'antd';
import { useMemo } from 'react';
import { type QueryParamQuickRow, queryParamRowsValid } from '../../data/rule-create/payload-rule-create';
import { buildQueryParamRuleUpdate, seedQueryParamRowsFromAction } from '../../data/rule-create/quick-rule-edit';
import { findRuleCollectionId } from '../../data/rule-create/rule-collection';
import { QueryParamQuickRows } from './QueryParamQuickRows';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

interface QueryParamRowsDraft {
  rows: QueryParamQuickRow[];
}

export interface QueryParamQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function QueryParamQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: QueryParamQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const paramRule: QueryParamRule | null = liveRule.type === 'query-param' ? liveRule : null;
  const editable = !!paramRule;

  const { localCollections } = useRules();
  const collectionId = useMemo(
    () => findRuleCollectionId(liveRule, localCollections),
    [liveRule, localCollections],
  );

  const canonical = useMemo<QueryParamRowsDraft | null>(
    () => (paramRule ? { rows: seedQueryParamRowsFromAction(paramRule.action) } : null),
    [paramRule],
  );
  const { draft, setDraft, draftRef, isDirty: rowsDirty } = useActionDraft({ canonical });
  const setRows = (updater: (prev: QueryParamQuickRow[]) => QueryParamQuickRow[]) => {
    setDraft((prev) => ({ rows: updater(prev.rows) }));
  };

  const condDraft = useConditionsDraft({ canonical: paramRule?.conditions ?? null });
  const isDirty = rowsDirty || condDraft.isDirty;

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: paramRule?.uid ?? null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      paramRule
        ? buildQueryParamRuleUpdate(
            paramRule,
            draftRef.current.rows,
            condDraft.isDirty ? condDraft.conditionsRef.current : undefined,
          )
        : {},
    isDirty,
    editable,
    valid: queryParamRowsValid(draft.rows ?? []),
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
          <QueryParamQuickRows rows={draft.rows ?? []} setRows={setRows} collectionId={collectionId} />
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {t('panel.quickEditor.openToInspect')}
        </div>
      )}
    </QuickEditorShell>
  );
}
