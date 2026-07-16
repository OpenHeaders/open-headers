/**
 * Generic save subsystem for the quick-editors' EDIT mode: the save
 * flow (build → mutate → surface result) and the Cmd/Ctrl+S listener.
 * Counterpart of `use-quick-create-save.ts` for existing rules — the
 * per-type payload builders (`*-rule-edit.ts` / `quick-rule-edit.ts`)
 * carry the publication gate so an atomic quick-edit keeps a published
 * rule live.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/dom/useSaveShortcut';
import type { RuleMutationResult, UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import type { RuleUpdates } from '@openheaders/ui/shared/sync/rule-write-client';
import type { App } from 'antd';
import { useState } from 'react';

type MessageApi = ReturnType<typeof App.useApp>['message'];

interface UseQuickEditSaveArgs {
  /** Live rule uid, or null when the rule is gone (Save stays off). */
  ruleUid: string | null;
  /** Builds the atomic update payload from the caller's draft refs.
   *  Called at save time, so it always sees the latest draft. */
  buildUpdates: () => RuleUpdates;
  isDirty: boolean;
  editable: boolean;
  /** Extra validity gate (e.g. redirect target resolves, delay ≥ 1). */
  valid?: boolean;
  mutator: UseRuleMutatorApi;
  message: MessageApi;
  onClose: () => void;
}

export interface QuickEditSaveApi {
  saving: boolean;
  canSave: boolean;
  handleSave: () => Promise<void>;
  saveLabel: string;
}

export function useQuickEditSave({
  ruleUid,
  buildUpdates,
  isDirty,
  editable,
  valid = true,
  mutator,
  message,
  onClose,
}: UseQuickEditSaveArgs): QuickEditSaveApi {
  const t = useT();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!ruleUid) return;
    setSaving(true);
    try {
      const result: RuleMutationResult = await mutator.updateRule(ruleUid, buildUpdates());
      surfaceResult(t, result, message, onClose);
    } finally {
      setSaving(false);
    }
  };

  const { saveLabel, handleSaveRef } = useSaveShortcut();

  const canSave = editable && isDirty && valid && !saving;
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  return { saving, canSave, handleSave, saveLabel };
}

function surfaceResult(t: Translate, result: RuleMutationResult, message: MessageApi, onSuccess: () => void): void {
  if (result.ok) {
    message.success(t('panel.quickEditor.toast.ruleUpdated'));
    onSuccess();
    return;
  }
  switch (result.reason) {
    case 'not-found':
      message.error(t('panel.quickEditor.toast.ruleNotFound'));
      return;
    case 'other':
      message.error(result.message ?? t('panel.quickEditor.toast.saveFailed'));
      return;
  }
}
