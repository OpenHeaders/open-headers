/**
 * ResponseQuickCreate — the create-mode body of the shared
 * `QuickEditorShell`. Opened from the Response tab's "Override
 * Response" CTA, pre-filled from the captured response
 * (`buildResponseDraftFromRequest`). Save mints the rule AND publishes
 * it in one gesture — the popover's Save is the publication gesture —
 * into the workspace's first collection (the same fallback the
 * workbench uses for context-less creates). The footer link hands the
 * CURRENT draft state off to the workbench for full options.
 *
 * Shell degradation: no live rule yet, so no presence badge and no
 * awareness publishing (uid-less), and the title shows the generated
 * draft name the rule will be created under.
 */

import type { ResponseRuleDraft } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Tag } from 'antd';
import { useRef, useState } from 'react';
import { useOpenRuleEditorDocument } from '../../data/rule-editor-document-intent';
import { handOffRuleDraft } from '../../data/rule-create/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/rule-create/smart-rule-name';
import {
  buildResponseRuleSeedFromWire,
  mergeQuickIntoResponseDraft,
  seedResponseQuickDraft,
} from '../../data/rule-create/response-rule-create';
import type { ResponseQuickDraft } from '../../data/rule-create/response-rule-edit';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickDestinationRow } from './QuickDestinationRow';
import { QuickEditorShell } from './QuickEditorShell';
import { ResponseQuickFields } from './ResponseQuickFields';
import { useQuickCreateConditions } from './use-quick-create-conditions';
import { useQuickCreateDestination } from './use-quick-create-destination';
import { useQuickCreateSave } from './use-quick-create-save';

export interface ResponseQuickCreateProps {
  anchorEl: HTMLElement;
  /** Captured-response draft built by the CTA (`rule-draft-bridge`). */
  draft: ResponseRuleDraft;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function ResponseQuickCreate({
  anchorEl,
  draft,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: ResponseQuickCreateProps) {
  const { message } = App.useApp();
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel', createOrigin: 'quick-editor' });
  const { rules } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Pre-filled from the capture; editable via the shell's title. The
  // seeded form baseline stays frozen per popover session.
  const [name, setName] = useState(() =>
    generateSmartRuleName({ kind: 'response', url: draft.url ?? '', responseSource: draft.responseSource }, rules),
  );
  // WIRE-space seed: the body editor owns its formatted view and emits
  // wire text per edit, so the form record carries the captured bytes.
  const [seed] = useState<ResponseQuickDraft>(() => seedResponseQuickDraft(draft));
  const [quick, setQuick] = useState<ResponseQuickDraft>(seed);
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const updateQuick = (patch: Partial<ResponseQuickDraft>) => {
    setQuick((prev) => ({ ...prev, ...patch }));
  };
  const quickDirty = stableStringify(quick) !== stableStringify(seed);

  const cond = useQuickCreateConditions(draft, strategy);
  const isDirty = quickDirty || cond.isDirty;

  const dest = useQuickCreateDestination(draft.url);

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildResponseRuleSeedFromWire(draft, quickRef.current, name, cond.conditionsRef.current),
    destination: dest.forSave,
    workspaceId,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void handOffRuleDraft(mergeQuickIntoResponseDraft(draft, quickRef.current))
      .then(() => onClose())
      .catch((err: Error) => message.error(err.message));
  };

  // In-panel escalation: the current form state (already wire text)
  // opens as a create-mode editor-tab document. Gated on the tab-group
  // owner having registered an opener (see the intent seam).
  const openRuleEditorDocument = useOpenRuleEditorDocument();
  const openInTab =
    openRuleEditorDocument === null
      ? undefined
      : () => {
          openRuleEditorDocument({
            mode: 'create',
            name,
            draft: mergeQuickIntoResponseDraft(draft, quickRef.current),
            ...(cond.isDirty ? { conditions: cond.conditionsRef.current } : {}),
          });
          onClose();
        };

  const isNetwork = draft.responseSource === 'network';

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={null}
      ruleType="response"
      ruleName={name}
      onRuleNameChange={setName}
      liveRuleUid={null}
      isDirty={isDirty}
      tags={
        <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} color={isNetwork ? 'blue' : 'purple'}>
          {isNetwork ? t('panel.quickEditor.response.tagModify') : t('panel.quickEditor.response.tagMock')}
        </Tag>
      }
      destination={<QuickDestinationRow api={dest} />}
      conditions={<QuickConditionsRow value={cond.conditions} onChange={cond.setConditions} />}
      onOpenInEditor={openInEditor}
      canOpenInEditor
      onOpenInTab={openInTab}
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      <ResponseQuickFields draft={quick} updateDraft={updateQuick} />
    </QuickEditorShell>
  );
}
