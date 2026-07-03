/**
 * Save subsystem for the response quick-editor: the save flow
 * (build → mutate → surface result) and the Cmd/Ctrl+S listener.
 * Counterpart of `use-rule-hover-save.ts` for response rules — the
 * payload builder (`buildResponseRuleUpdate`) carries the publication
 * gate so an atomic quick-edit keeps a published rule live.
 */

import type { ResponseRule, RuleCondition } from '@openheaders/core/types';
import type { RuleMutationResult, UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/useSaveShortcut';
import type { App } from 'antd';
import { type RefObject, useState } from 'react';
import { buildResponseRuleUpdate, type ResponseQuickDraft } from '../../data/rule-create/response-rule-edit';

type MessageApi = ReturnType<typeof App.useApp>['message'];

interface UseResponseSaveArgs {
  responseRule: ResponseRule | null;
  draftRef: RefObject<ResponseQuickDraft>;
  isDirty: boolean;
  editable: boolean;
  /** Conditions row draft — included in the batch only when dirty. */
  conditionsRef: RefObject<RuleCondition[]>;
  conditionsDirty: boolean;
  mutator: UseRuleMutatorApi;
  message: MessageApi;
  onClose: () => void;
}

export interface ResponseSaveApi {
  saving: boolean;
  canSave: boolean;
  handleSave: () => Promise<void>;
  saveLabel: string;
}

export function useResponseSave({
  responseRule,
  draftRef,
  isDirty,
  editable,
  conditionsRef,
  conditionsDirty,
  mutator,
  message,
  onClose,
}: UseResponseSaveArgs): ResponseSaveApi {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!responseRule) return;
    setSaving(true);
    try {
      const updates = buildResponseRuleUpdate(
        responseRule,
        draftRef.current,
        conditionsDirty ? conditionsRef.current : undefined,
      );
      const result: RuleMutationResult = await mutator.updateRule(responseRule.uid, updates);
      surfaceResult(result, message, onClose);
    } finally {
      setSaving(false);
    }
  };

  const { saveLabel, handleSaveRef } = useSaveShortcut();

  // Status comes from a fixed select and content-type/body are free
  // text, so the gate is just dirty + editable — there is no invalid
  // draft shape to guard against.
  const canSave = editable && isDirty && !saving;
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  return { saving, canSave, handleSave, saveLabel };
}

function surfaceResult(result: RuleMutationResult, message: MessageApi, onSuccess: () => void): void {
  if (result.ok) {
    message.success('Rule updated');
    onSuccess();
    return;
  }
  switch (result.reason) {
    case 'not-found':
      message.error('Rule not found — it may have been deleted.');
      return;
    case 'other':
      message.error(result.message ?? 'Save failed');
      return;
  }
}
