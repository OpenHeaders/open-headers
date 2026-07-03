/**
 * Save subsystem for the header quick-editor's CREATE mode: validation
 * gate (same core validators as the edit popover's save hook — broken
 * mods never reach the rule store) on top of the shared create →
 * publish chain (`use-quick-create-save`).
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
import type { RefObject } from 'react';
import { buildHeaderRuleSeed, type HeaderDirection, type HeaderQuickDraft } from '../../data/header-rule-create';
import { type QuickCreateSaveApi, useQuickCreateSave } from './use-quick-create-save';

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

export interface HeaderCreateSaveApi extends QuickCreateSaveApi {
  nameValidation: HeaderNameValidation | { valid: true; message: string };
  valueValidation: HeaderValueValidation | { valid: true; message: string };
  capability: HeaderOperationCapability | null;
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

  const save = useQuickCreateSave({
    buildSeed: () => buildHeaderRuleSeed(draft, quickRef.current, direction, name, strategy),
    parentPath,
    valid:
      trimmedName.length > 0 && nameValidation.valid && valueValidation.valid && (!capability || capability.allowed),
    mutator,
    message,
    onClose,
  });

  return { ...save, nameValidation, valueValidation, capability };
}
