/**
 * HeaderQuickEditor — the whole-rule header plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Matched Rules panel,
 * where there is no header row to pinpoint one modification (the
 * Headers-tab hover keeps `RuleHoverPopover`, which edits the single
 * pinpointed mod with conflict chips and the fire snapshot). Surfaces
 * the rule's FULL modification list as compact rows — direction,
 * operation, name, value — mirroring the query-param editor's
 * whole-list shape.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { HeaderRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { App, Button, Select, theme } from 'antd';
import { useMemo } from 'react';
import {
  appendHeaderModRow,
  buildHeaderRuleUpdate,
  firstHeaderModRowIssue,
  type HeaderModQuickRow,
  seedHeaderModRows,
} from '../../data/rule-create/quick-rule-edit';
import { findRuleCollectionId } from '../../data/rule-create/rule-collection';
import { HEADER_OPERATION_OPTIONS } from './header-operation-options';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

const DIRECTION_OPTIONS = [
  { value: 'request', label: 'Request' },
  { value: 'response', label: 'Response' },
] as const;

interface HeaderModRowsDraft {
  rows: HeaderModQuickRow[];
}

export interface HeaderQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function HeaderQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: HeaderQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const headerRule: HeaderRule | null = liveRule.type === 'header' ? liveRule : null;
  const editable = !!headerRule;

  const { localCollections } = useRules();
  const collectionId = useMemo(
    () => findRuleCollectionId(liveRule, localCollections),
    [liveRule, localCollections],
  );

  const canonical = useMemo<HeaderModRowsDraft | null>(
    () => (headerRule ? { rows: seedHeaderModRows(headerRule.action) } : null),
    [headerRule],
  );
  const { draft, setDraft, draftRef, isDirty: rowsDirty } = useActionDraft({ canonical });
  const rows = draft.rows ?? [];
  const setRows = (updater: (prev: HeaderModQuickRow[]) => HeaderModQuickRow[]) => {
    setDraft((prev) => ({ rows: updater(prev.rows ?? []) }));
  };
  const updateRow = (uid: string, patch: Partial<HeaderModQuickRow>) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };
  const removeRow = (uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  };

  const condDraft = useConditionsDraft({ canonical: headerRule?.conditions ?? null });
  const isDirty = rowsDirty || condDraft.isDirty;

  const issue = useMemo(() => firstHeaderModRowIssue(rows), [rows]);

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: headerRule?.uid ?? null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      headerRule
        ? buildHeaderRuleUpdate(
            headerRule,
            draftRef.current.rows ?? [],
            condDraft.isDirty ? condDraft.conditionsRef.current : undefined,
          )
        : {},
    isDirty,
    editable,
    valid: !issue,
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
          {rows.map((row) => (
            <div key={row.uid} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Select
                  size="small"
                  value={row.direction}
                  onChange={(direction) => updateRow(row.uid, { direction })}
                  options={[...DIRECTION_OPTIONS]}
                  style={{ width: 96, flexShrink: 0 }}
                  dropdownStyle={{ zIndex: 1090 }}
                />
                <Select
                  size="small"
                  value={row.operation}
                  onChange={(operation) => updateRow(row.uid, { operation })}
                  options={HEADER_OPERATION_OPTIONS}
                  style={{ width: 116, flexShrink: 0 }}
                  dropdownStyle={{ zIndex: 1090 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TemplateInput
                    size="small"
                    wrap
                    maxRows={4}
                    resizable
                    allowClear
                    value={row.headerName}
                    onChange={(v) => updateRow(row.uid, { headerName: v })}
                    placeholder="Header Name"
                    suggestionContext={{ collectionId }}
                  />
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined style={{ fontSize: 10 }} />}
                  onClick={() => removeRow(row.uid)}
                  disabled={rows.length === 1}
                  style={{ color: token.colorTextTertiary, flexShrink: 0 }}
                />
              </div>
              {row.operation !== 'remove' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TemplateInput
                      size="small"
                      wrap
                      maxRows={4}
                      resizable
                      allowClear
                      value={row.value}
                      onChange={(v) => updateRow(row.uid, { value: v })}
                      placeholder={row.operation === 'merge' ? 'Value to append' : 'Header Value'}
                      suggestionContext={{ collectionId }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {row.operation === 'merge' && (
                    <input
                      type="text"
                      value={row.mergeSeparator ?? ''}
                      onChange={(e) => updateRow(row.uid, { mergeSeparator: e.target.value })}
                      placeholder="; "
                      title="Merge separator"
                      style={{
                        width: 36,
                        textAlign: 'center',
                        fontFamily: token.fontFamilyCode,
                        fontSize: 12,
                        border: `1px solid ${token.colorBorder}`,
                        borderRadius: token.borderRadius,
                        padding: '0 4px',
                        height: 24,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => setRows(appendHeaderModRow)}
            icon={<PlusOutlined />}
            size="small"
            style={{ fontSize: 12 }}
          >
            Add header
          </Button>
          {issue && (
            <div style={{ marginTop: 6, fontSize: 11, color: token.colorError, lineHeight: 1.4 }}>
              {issue.message}
              {issue.suggestion && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => updateRow(issue.uid, { operation: issue.suggestion })}
                  style={{ padding: '0 0 0 6px', height: 'auto', fontSize: 11 }}
                >
                  Switch to {issue.suggestion}
                </Button>
              )}
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
