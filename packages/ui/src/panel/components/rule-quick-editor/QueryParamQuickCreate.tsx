/**
 * QueryParamQuickCreate — the query-param create-mode body of the
 * shared `QuickEditorShell`. Opened from the Payload tab's "Override
 * query params" CTA, pre-filled with the captured query string (each
 * observed param as an Override row — `rule-draft-bridge`). Rows follow
 * the workbench editor's shape: [operation] [param] [value] [remove],
 * plus an add-row affordance. Save mints the rule AND publishes it in
 * one gesture; the footer link hands the CURRENT rows off to the
 * workbench for full options.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import type { QueryParamRuleDraft } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Button, Select, Typography, theme } from 'antd';
import { useRef, useState } from 'react';
import {
  appendQueryParamQuickRow,
  buildQueryParamRuleSeed,
  mergeQuickIntoQueryParamDraft,
  type QueryParamQuickRow,
  queryParamRowsValid,
  seedQueryParamQuickRows,
} from '../../data/payload-rule-create';
import { handOffRuleDraft } from '../../data/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/smart-rule-name';
import { QuickDestinationRow } from './QuickDestinationRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useQuickCreateDestination } from './use-quick-create-destination';
import { useQuickCreateSave } from './use-quick-create-save';

const { Text } = Typography;

// Same casing + wording as the workbench editor so the cross-surface
// UX stays consistent ("Replace Only" = skips URLs without the param).
const OPERATION_OPTIONS = [
  { value: 'add', label: 'Add / Replace' },
  { value: 'override', label: 'Replace Only' },
  { value: 'remove', label: 'Remove' },
  { value: 'remove-all', label: 'Remove All' },
] as const;

export interface QueryParamQuickCreateProps {
  anchorEl: HTMLElement;
  /** Captured-request draft built by the CTA (`rule-draft-bridge`). */
  draft: QueryParamRuleDraft;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function QueryParamQuickCreate({
  anchorEl,
  draft,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: QueryParamQuickCreateProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const { rules } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Pre-filled from the capture; editable via the shell's title.
  const [name, setName] = useState(() => generateSmartRuleName({ kind: 'query-param', url: draft.url ?? '' }, rules));
  const [seed] = useState<QueryParamQuickRow[]>(() => seedQueryParamQuickRows(draft));
  const [rows, setRows] = useState<QueryParamQuickRow[]>(seed);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const isDirty = stableStringify(rows) !== stableStringify(seed);

  const updateRow = (uid: string, patch: Partial<QueryParamQuickRow>) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };
  const removeRow = (uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  };

  const dest = useQuickCreateDestination(draft.url);
  const collectionId = dest.collectionId;

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildQueryParamRuleSeed(draft, rowsRef.current, name, strategy),
    destination: dest.forSave,
    workspaceId,
    valid: queryParamRowsValid(rows),
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void handOffRuleDraft(mergeQuickIntoQueryParamDraft(draft, rowsRef.current))
      .then(() => onClose())
      .catch((err: Error) => message.error(err.message));
  };

  const hasRemoveAll = rows.some((r) => r.operation === 'remove-all');
  const hasOtherOps = rows.some((r) => r.operation !== 'remove-all');

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={null}
      ruleType="query-param"
      ruleName={name}
      onRuleNameChange={setName}
      liveRuleUid={null}
      isDirty={isDirty}
      destination={<QuickDestinationRow api={dest} />}
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      {rows.map((row) => (
        <div key={row.uid} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <Select
            size="small"
            value={row.operation}
            onChange={(op) => updateRow(row.uid, { operation: op })}
            options={[...OPERATION_OPTIONS]}
            style={{ width: 125, flexShrink: 0 }}
            dropdownStyle={{ zIndex: 1090 }}
          />
          {row.operation === 'remove-all' ? (
            <Text type="secondary" style={{ fontSize: 11, flex: 1 }}>
              Removes all query parameters from the URL
            </Text>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TemplateInput
                  size="small"
                  value={row.param}
                  onChange={(v) => updateRow(row.uid, { param: v })}
                  placeholder="Param Name"
                  suggestionContext={{ collectionId }}
                />
              </div>
              {row.operation !== 'remove' && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TemplateInput
                    size="small"
                    value={row.value}
                    onChange={(v) => updateRow(row.uid, { value: v })}
                    placeholder="Param Value"
                    suggestionContext={{ collectionId }}
                  />
                </div>
              )}
            </>
          )}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ fontSize: 10 }} />}
            onClick={() => removeRow(row.uid)}
            disabled={rows.length === 1}
            style={{ color: token.colorTextTertiary, flexShrink: 0 }}
          />
        </div>
      ))}
      <Button
        type="dashed"
        onClick={() => setRows(appendQueryParamQuickRow)}
        icon={<PlusOutlined />}
        size="small"
        style={{ fontSize: 12 }}
      >
        Add action
      </Button>
      {hasRemoveAll && hasOtherOps && (
        <div style={{ marginTop: 6, fontSize: 11, color: token.colorWarning, lineHeight: 1.4 }}>
          Remove All strips the entire query string — the other operations in this rule will be ignored.
        </div>
      )}
    </QuickEditorShell>
  );
}
