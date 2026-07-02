/**
 * Save subsystem for the response quick-editor's CREATE mode: build the
 * seed, mint the entity, and cross the publication gate — the popover's
 * Save IS the publication gesture (parity with the workbench scratch
 * Save in `useSaveRuleFlow.persist`). Create Save is always meaningful
 * (the user asked to override this response), so the gate is just
 * !saving — no dirty tracking.
 */

import type { ResponseRuleDraft } from '@openheaders/core/types';
import type { DraftUrlStrategy } from '@openheaders/core/utils';
import type { UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/useRuleMutator';
import type { App } from 'antd';
import { type RefObject, useState } from 'react';
import { buildResponseRuleSeed } from '../../data/response-rule-create';
import type { ResponseQuickDraft } from '../../data/response-rule-edit';
import { useSaveShortcut } from './use-save-shortcut';

type MessageApi = ReturnType<typeof App.useApp>['message'];

interface UseResponseCreateSaveArgs {
  draft: ResponseRuleDraft;
  quickRef: RefObject<ResponseQuickDraft>;
  name: string;
  /** Destination collection path — null when the workspace has none. */
  parentPath: string | null;
  strategy: DraftUrlStrategy;
  mutator: UseRuleMutatorApi;
  message: MessageApi;
  onClose: () => void;
}

export interface ResponseCreateSaveApi {
  saving: boolean;
  canSave: boolean;
  handleSave: () => Promise<void>;
  saveLabel: string;
}

export function useResponseCreateSave({
  draft,
  quickRef,
  name,
  parentPath,
  strategy,
  mutator,
  message,
  onClose,
}: UseResponseCreateSaveArgs): ResponseCreateSaveApi {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!parentPath) {
      message.error('Create a collection in the workspace first.');
      return;
    }
    setSaving(true);
    try {
      const seed = buildResponseRuleSeed(draft, quickRef.current, name, strategy);
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

  const canSave = !saving;
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  return { saving, canSave, handleSave, saveLabel };
}
