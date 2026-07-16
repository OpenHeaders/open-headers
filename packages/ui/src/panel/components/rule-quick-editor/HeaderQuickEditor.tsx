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
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { DetectedValueInput } from '@openheaders/ui/workbench/components/value-editors';
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
import { useOpenValueDocument } from '../../data/value-document-intent';
import { headerOperationOptions } from './header-operation-options';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

const directionOptions = (t: Translate) =>
  [
    { value: 'request', label: t('panel.quickEditor.header.directionRequest') },
    { value: 'response', label: t('panel.quickEditor.header.directionResponse') },
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
  const t = useT();
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

  const issue = useMemo(() => firstHeaderModRowIssue(t, rows), [t, rows]);

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

  // "Open as document" escalation from the compact value editor —
  // offered only for rows the CANONICAL rule actually carries (a row
  // added in this popover has no persisted field for a tab to read;
  // the tab reads the canonical, not the popover's draft). Opening
  // closes the popover; its ephemeral drafts die with it by design.
  const openValueDocument = useOpenValueDocument();
  const documentOpenerFor = (row: HeaderModQuickRow): (() => void) | undefined => {
    if (openValueDocument === null || headerRule === null) return undefined;
    const inRequest = headerRule.action.requestHeaders.find((m) => m.uid === row.uid);
    const mod = inRequest ?? headerRule.action.responseHeaders.find((m) => m.uid === row.uid);
    if (mod === undefined || mod.operation === 'remove' || mod.value === undefined) return undefined;
    const direction = inRequest !== undefined ? 'request' : 'response';
    return () => {
      openValueDocument({ ruleUid: headerRule.uid, direction, modUid: mod.uid, headerName: mod.headerName });
      onClose();
    };
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
                  options={[...directionOptions(t)]}
                  style={{ width: 96, flexShrink: 0 }}
                  dropdownStyle={{ zIndex: 1090 }}
                />
                <Select
                  size="small"
                  value={row.operation}
                  onChange={(operation) => updateRow(row.uid, { operation })}
                  options={headerOperationOptions(t)}
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
                    placeholder={t('workbench.editors.rule.fields.header.namePlaceholder')}
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
                    <DetectedValueInput
                      editorVariant="compact"
                      onOpenDocument={documentOpenerFor(row)}
                      size="small"
                      wrap
                      maxRows={4}
                      resizable
                      allowClear
                      value={row.value}
                      onChange={(v) => updateRow(row.uid, { value: v })}
                      placeholder={t(
                        row.operation === 'merge'
                          ? 'workbench.editors.rule.fields.header.appendValuePlaceholder'
                          : 'workbench.editors.rule.fields.header.valuePlaceholder',
                      )}
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
                      title={t('panel.quickEditor.header.mergeSeparatorTitle')}
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
            {t('panel.quickEditor.header.addHeader')}
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
                  {t('panel.quickEditor.validation.switchTo', { operation: issue.suggestion })}
                </Button>
              )}
            </div>
          )}
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {t('panel.quickEditor.openToInspect')}
        </div>
      )}
    </QuickEditorShell>
  );
}
