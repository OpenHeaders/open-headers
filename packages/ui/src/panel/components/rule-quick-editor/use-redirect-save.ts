/**
 * Save subsystem for the redirect quick-editor: the save flow
 * (build → mutate → surface result) and the Cmd/Ctrl+S listener.
 * Counterpart of `use-response-save.ts` for redirect rules — the
 * payload builder (`buildRedirectRuleUpdate`) carries the publication
 * gate so an atomic quick-edit keeps a published rule live.
 */

import type { RedirectRule, RuleCondition } from '@openheaders/core/types';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/dom/useSaveShortcut';
import type { RuleMutationResult, UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import type { App } from 'antd';
import { type RefObject, useState } from 'react';
import { buildRedirectRuleUpdate, type RedirectQuickEditDraft } from '../../data/rule-create/redirect-rule-edit';

type MessageApi = ReturnType<typeof App.useApp>['message'];

interface UseRedirectSaveArgs {
  redirectRule: RedirectRule | null;
  draftRef: RefObject<RedirectQuickEditDraft>;
  isDirty: boolean;
  editable: boolean;
  /** Target validity — non-empty and every `{{ref}}` resolves. A saved
   *  redirect with an unresolvable template would silently never fire. */
  valid: boolean;
  /** Conditions row draft — included in the batch only when dirty. */
  conditionsRef: RefObject<RuleCondition[]>;
  conditionsDirty: boolean;
  mutator: UseRuleMutatorApi;
  message: MessageApi;
  onClose: () => void;
}

export interface RedirectSaveApi {
  saving: boolean;
  canSave: boolean;
  handleSave: () => Promise<void>;
  saveLabel: string;
}

export function useRedirectSave({
  redirectRule,
  draftRef,
  isDirty,
  editable,
  valid,
  conditionsRef,
  conditionsDirty,
  mutator,
  message,
  onClose,
}: UseRedirectSaveArgs): RedirectSaveApi {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!redirectRule) return;
    setSaving(true);
    try {
      const updates = buildRedirectRuleUpdate(
        redirectRule,
        draftRef.current,
        conditionsDirty ? conditionsRef.current : undefined,
      );
      const result: RuleMutationResult = await mutator.updateRule(redirectRule.uid, updates);
      surfaceResult(result, message, onClose);
    } finally {
      setSaving(false);
    }
  };

  const { saveLabel, handleSaveRef } = useSaveShortcut();

  const canSave = editable && isDirty && valid && !saving;
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
