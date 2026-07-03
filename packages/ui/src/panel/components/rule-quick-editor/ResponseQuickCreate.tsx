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
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Tag } from 'antd';
import { useRef, useState } from 'react';
import { handOffRuleDraft } from '../../data/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/smart-rule-name';
import { buildResponseRuleSeed, mergeQuickIntoResponseDraft, seedQuickDraft } from '../../data/response-rule-create';
import type { ResponseQuickDraft } from '../../data/response-rule-edit';
import { QuickEditorShell } from './QuickEditorShell';
import { ResponseQuickFields } from './ResponseQuickFields';
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
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const { rules, localCollections } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Pre-filled from the capture; editable via the shell's title. The
  // seeded form baseline stays frozen per popover session.
  const [name, setName] = useState(() =>
    generateSmartRuleName({ kind: 'response', url: draft.url ?? '', responseSource: draft.responseSource }, rules),
  );
  const [seed] = useState<ResponseQuickDraft>(() => seedQuickDraft(draft));
  const [quick, setQuick] = useState<ResponseQuickDraft>(seed);
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const updateQuick = (patch: Partial<ResponseQuickDraft>) => {
    setQuick((prev) => ({ ...prev, ...patch }));
  };
  const isDirty = stableStringify(quick) !== stableStringify(seed);

  // Context-less create falls back to the first collection — the same
  // fallback `useTabOpeners.openCreateTab` applies in the workbench.
  // Its uid also scopes the body's `{{collection.X}}` suggestions to
  // where the rule will actually live.
  const destinationCollection = localCollections[0] ?? null;
  const parentPath = destinationCollection?.path ?? null;
  const collectionId = destinationCollection?.uid;

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildResponseRuleSeed(draft, quickRef.current, name, strategy),
    parentPath,
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
          {isNetwork ? 'Modify' : 'Mock'}
        </Tag>
      }
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      <ResponseQuickFields draft={quick} updateDraft={updateQuick} collectionId={collectionId} />
    </QuickEditorShell>
  );
}
