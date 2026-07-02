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
import { generateResponseRuleName, mergeQuickIntoResponseDraft, seedQuickDraft } from '../../data/response-rule-create';
import type { ResponseQuickDraft } from '../../data/response-rule-edit';
import { QuickEditorShell } from './QuickEditorShell';
import { ResponseQuickFields } from './ResponseQuickFields';
import { useResponseCreateSave } from './use-response-create-save';

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

  // Frozen per popover session (the host remounts per identity): the
  // name the rule will be created under and the seeded form baseline.
  const [name] = useState(() => generateResponseRuleName(rules));
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
  const parentPath = localCollections[0]?.path ?? null;

  const { saving, canSave, handleSave, saveLabel } = useResponseCreateSave({
    draft,
    quickRef,
    name,
    parentPath,
    strategy,
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
      <ResponseQuickFields draft={quick} updateDraft={updateQuick} />
    </QuickEditorShell>
  );
}
