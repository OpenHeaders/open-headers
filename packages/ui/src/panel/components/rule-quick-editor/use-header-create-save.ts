/**
 * Save subsystem for the header quick-editor's CREATE mode: validation
 * gate (same core validators as the edit popover's save hook — broken
 * mods never reach the rule store), seed build, create, and the
 * publication gate — the popover's Save IS the publication gesture.
 * Create Save needs no dirty gate (the user asked to override this
 * header), only a valid draft.
 */

import type { HeaderRuleDraft } from '@openheaders/core/types';
import {
  type DraftUrlStrategy,
  getHeaderOperationCapability,
  type HeaderNameValidation,
  type HeaderOperationCapability,
  type HeaderValueValidation,
  validateHeaderName,
  validateHeaderValue,
} from '@openheaders/core/utils';
import type { UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/useRuleMutator';
import type { App } from 'antd';
import { type RefObject, useState } from 'react';
import { buildHeaderRuleSeed, type HeaderDirection, type HeaderQuickDraft } from '../../data/header-rule-create';
import { useSaveShortcut } from './use-save-shortcut';

type MessageApi = ReturnType<typeof App.useApp>['message'];

interface UseHeaderCreateSaveArgs {
  draft: HeaderRuleDraft;
  quick: HeaderQuickDraft;
  quickRef: RefObject<HeaderQuickDraft>;
  direction: HeaderDirection;
  name: string;
  /** Destination collection path — null when the workspace has none. */
  parentPath: string | null;
  strategy: DraftUrlStrategy;
  mutator: UseRuleMutatorApi;
  message: MessageApi;
  onClose: () => void;
}

export interface HeaderCreateSaveApi {
  saving: boolean;
  canSave: boolean;
  nameValidation: HeaderNameValidation | { valid: true; message: string };
  valueValidation: HeaderValueValidation | { valid: true; message: string };
  capability: HeaderOperationCapability | null;
  handleSave: () => Promise<void>;
  saveLabel: string;
}

export function useHeaderCreateSave({
  draft,
  quick,
  quickRef,
  direction,
  name,
  parentPath,
  strategy,
  mutator,
  message,
  onClose,
}: UseHeaderCreateSaveArgs): HeaderCreateSaveApi {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!parentPath) {
      message.error('Create a collection in the workspace first.');
      return;
    }
    setSaving(true);
    try {
      const seed = buildHeaderRuleSeed(draft, quickRef.current, direction, name, strategy);
      const created = await mutator.createRule(seed, parentPath);
      if (!created.ok) {
        const detail = created.reason === 'other' ? created.message : undefined;
        message.error(detail ?? 'Failed to create rule');
        return;
      }
      const published = await mutator.publishRule(created.rule.uid);
      if (!published.ok) {
        message.warning('Rule created as a draft — publish it from the workspace.');
        onClose();
        return;
      }
      message.success('Rule created');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const { saveLabel, handleSaveRef } = useSaveShortcut();

  // Same validators the edit popover and the workbench editor use.
  // Templates pass through (resolved at runtime; structural validity
  // isn't decidable at edit time).
  const isResponse = direction === 'response';
  const trimmedName = quick.headerName.trim();
  const nameValidation =
    trimmedName && !trimmedName.includes('{{')
      ? validateHeaderName(trimmedName, isResponse)
      : { valid: true as const, message: '' };
  const valueValidation =
    quick.operation !== 'remove' && quick.value && !quick.value.includes('{{')
      ? validateHeaderValue(quick.value, trimmedName)
      : { valid: true as const, message: '' };
  const capability = getHeaderOperationCapability(direction, quick.operation, quick.headerName);

  const canSave =
    !saving &&
    trimmedName.length > 0 &&
    nameValidation.valid &&
    valueValidation.valid &&
    (!capability || capability.allowed);
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  return { saving, canSave, nameValidation, valueValidation, capability, handleSave, saveLabel };
}
