/**
 * Shared save chain for every quick-editor CREATE body: build the seed,
 * mint the entity, and cross the publication gate — the popover's Save
 * IS the publication gesture (parity with the workbench scratch Save in
 * `useSaveRuleFlow.persist`). The write client forces `published:
 * false` at creation; publishing is the explicit second step, and a
 * publish failure degrades honestly to a draft.
 *
 * Per-type bodies supply `buildSeed` (reading their live form state via
 * a ref) and an optional `valid` gate on top of the always-on `!saving`
 * — create Save needs no dirty gate (the user asked for the rule), only
 * a valid draft.
 */

import type { RuleSeed } from '@openheaders/core/utils';
import type { UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/useRuleMutator';
import type { App } from 'antd';
import { useState } from 'react';
import { useSaveShortcut } from './use-save-shortcut';

type MessageApi = ReturnType<typeof App.useApp>['message'];

interface UseQuickCreateSaveArgs {
  /** Builds the full rule seed from the CURRENT form state. */
  buildSeed: () => RuleSeed;
  /** Destination collection path — null when the workspace has none. */
  parentPath: string | null;
  /** Extra validity gate on top of `!saving`; defaults to true. */
  valid?: boolean;
  mutator: UseRuleMutatorApi;
  message: MessageApi;
  onClose: () => void;
}

export interface QuickCreateSaveApi {
  saving: boolean;
  canSave: boolean;
  handleSave: () => Promise<void>;
  saveLabel: string;
}

export function useQuickCreateSave({
  buildSeed,
  parentPath,
  valid = true,
  mutator,
  message,
  onClose,
}: UseQuickCreateSaveArgs): QuickCreateSaveApi {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!parentPath) {
      message.error('Create a collection in the workspace first.');
      return;
    }
    setSaving(true);
    try {
      const created = await mutator.createRule(buildSeed(), parentPath);
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

  const canSave = !saving && valid;
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  return { saving, canSave, handleSave, saveLabel };
}
