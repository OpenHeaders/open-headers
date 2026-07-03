/**
 * Save subsystem for the rule hover popover's editor block: the draft
 * validation gate, the save flow (build → mutate → surface result),
 * and the Cmd/Ctrl+S listener. Extracted verbatim from
 * `RuleHoverPopover` — the gate mirrors the workbench editor's
 * `isRuleComplete` contract and is behavior-pinned by
 * `rule-hover-popover-save-gate.test.ts`.
 */

import type { HeaderModification, HeaderRule } from '@openheaders/core/types';
import {
  getHeaderOperationCapability,
  type HeaderNameValidation,
  type HeaderOperationCapability,
  type HeaderValueValidation,
  validateHeaderName,
  validateHeaderValue,
} from '@openheaders/core/utils';
import type { RuleMutationResult, UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/useSaveShortcut';
import type { App } from 'antd';
import { type RefObject, useState } from 'react';
import { buildHeaderModUpdate } from '../data/rule-create/header-mod-edit';
import type { RuleHoverPopoverTarget } from './RuleHoverPopover';
import type { ModDraft } from './use-mod-draft';

type MessageApi = ReturnType<typeof App.useApp>['message'];

interface UseRuleHoverSaveArgs {
  headerRule: HeaderRule | null;
  currentMod: HeaderModification | null;
  target: RuleHoverPopoverTarget | undefined;
  draft: ModDraft;
  draftRef: RefObject<ModDraft>;
  isDirty: boolean;
  editable: boolean;
  mutator: UseRuleMutatorApi;
  message: MessageApi;
  clearDismissed: () => void;
  onClose: () => void;
}

export interface RuleHoverSaveApi {
  saving: boolean;
  canSave: boolean;
  nameValidation: HeaderNameValidation | { valid: true; message: string };
  valueValidation: HeaderValueValidation | { valid: true; message: string };
  capability: HeaderOperationCapability | null;
  handleSave: () => Promise<void>;
  saveLabel: string;
}

export function useRuleHoverSave({
  headerRule,
  currentMod,
  target,
  draft,
  draftRef,
  isDirty,
  editable,
  mutator,
  message,
  clearDismissed,
  onClose,
}: UseRuleHoverSaveArgs): RuleHoverSaveApi {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!headerRule || !currentMod || !target) return;
    const live = draftRef.current;
    setSaving(true);
    try {
      const built = buildHeaderModUpdate(headerRule, target.direction, currentMod, live);
      if (!built.ok) {
        message.warning('Rule changed elsewhere — close and reopen the popover.');
        return;
      }
      const result: RuleMutationResult = await mutator.updateRule(headerRule.uid, built.updates);
      surfaceResult(result, message, () => {
        // Dirty auto-clears when the broadcast lands and currentMod
        // matches draft. No explicit reset needed.
        clearDismissed();
        onClose();
      });
    } finally {
      setSaving(false);
    }
  };

  // Save shortcut listener — mirrors variable popover so Cmd/Ctrl+S
  // saves regardless of focused element while the popover is mounted.
  const { saveLabel, handleSaveRef } = useSaveShortcut();

  // Full draft validation — same validators core uses for the workbench
  // editor and `isRuleComplete`. Templates pass through (resolved at
  // runtime; structural validity isn't decidable at edit time).
  const isResponse = target?.direction === 'response';
  const trimmedName = draft.headerName.trim();
  const nameValidation =
    editable && trimmedName && !trimmedName.includes('{{')
      ? validateHeaderName(trimmedName, isResponse)
      : { valid: true as const, message: '' };
  const valueValidation =
    editable && draft.operation !== 'remove' && draft.value && !draft.value.includes('{{')
      ? validateHeaderValue(draft.value, trimmedName)
      : { valid: true as const, message: '' };
  // Capability judges the OPERATION only once the name itself is valid —
  // its internal name check would otherwise duplicate `nameValidation`'s
  // message, and misfire on template names (resolved at runtime).
  const capability =
    editable && target && nameValidation.valid && !trimmedName.includes('{{')
      ? getHeaderOperationCapability(target.direction, draft.operation, draft.headerName)
      : null;

  // Save is gated on every error: empty name, invalid name, invalid
  // value, capability violation. Mirrors the workbench editor's
  // `isRuleComplete` contract — broken edits never reach the rule
  // store.
  const canSave =
    editable &&
    isDirty &&
    !saving &&
    trimmedName.length > 0 &&
    nameValidation.valid &&
    valueValidation.valid &&
    (!capability || capability.allowed);
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  return { saving, canSave, nameValidation, valueValidation, capability, handleSave, saveLabel };
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
