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

import type { QueryParamRuleDraft } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App } from 'antd';
import { useRef, useState } from 'react';
import {
  buildQueryParamRuleSeed,
  mergeQuickIntoQueryParamDraft,
  type QueryParamQuickRow,
  queryParamRowsValid,
  seedQueryParamQuickRows,
} from '../../data/rule-create/payload-rule-create';
import { handOffRuleDraft } from '../../data/rule-create/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/rule-create/smart-rule-name';
import { QueryParamQuickRows } from './QueryParamQuickRows';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickDestinationRow } from './QuickDestinationRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useQuickCreateConditions } from './use-quick-create-conditions';
import { useQuickCreateDestination } from './use-quick-create-destination';
import { useQuickCreateSave } from './use-quick-create-save';

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
  const rowsDirty = stableStringify(rows) !== stableStringify(seed);

  const cond = useQuickCreateConditions(draft, strategy);
  const isDirty = rowsDirty || cond.isDirty;

  const dest = useQuickCreateDestination(draft.url);
  const collectionId = dest.collectionId;

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildQueryParamRuleSeed(rowsRef.current, name, cond.conditionsRef.current),
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
      conditions={<QuickConditionsRow value={cond.conditions} onChange={cond.setConditions} />}
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      <QueryParamQuickRows rows={rows} setRows={setRows} collectionId={collectionId} />
    </QuickEditorShell>
  );
}
