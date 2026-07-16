/**
 * Shared save chain for every quick-editor CREATE body: resolve the
 * destination, build the seed, mint the entity, and cross the
 * publication gate — the popover's Save IS the publication gesture
 * (parity with the workbench scratch Save in `useSaveRuleFlow.persist`).
 * The write client forces `published: false` at creation; publishing is
 * the explicit second step, and a publish failure degrades honestly to
 * a draft.
 *
 * Destination resolution mints what the plan says is missing: a
 * collection-less workspace gets `New Rules Collection` (the sidebar's
 * create-action name), and a pending domain folder
 * (`quick-rule-destination.ts`) is created under the collection root —
 * the compact popover has no room for the workbench's
 * SaveToCollectionModal ceremony, so Save does the organizing. A folder
 * mint failure degrades to the collection root with a warning rather
 * than blocking the rule.
 *
 * Per-type bodies supply `buildSeed` (reading their live form state via
 * a ref) and an optional `valid` gate on top of the always-on `!saving`
 * — create Save needs no dirty gate (the user asked for the rule), only
 * a valid draft.
 */

import { COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import { generateUid, type RuleSeed, toFolderName } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/dom/useSaveShortcut';
import type { UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { NEW_RULES_COLLECTION_NAME } from '@openheaders/ui/shared/naming';
import { applyCollectionCreate } from '@openheaders/ui/shared/sync/collection-write-client';
import { applyFolderCreate } from '@openheaders/ui/shared/sync/folder-write-client';
import type { App } from 'antd';
import { useState } from 'react';

type MessageApi = ReturnType<typeof App.useApp>['message'];

/** Where the rule lands — produced by `useQuickCreateDestination`. */
export interface QuickCreateDestination {
  /** Chosen collection — null when the workspace has none yet. */
  collection: { uid: string; path: string } | null;
  /** Existing folder to create into (inside the collection). */
  folderPath: string | null;
  /** Folder to mint at save time under the collection root. */
  newFolderName: string | null;
}

interface UseQuickCreateSaveArgs {
  /** Builds the full rule seed from the CURRENT form state. */
  buildSeed: () => RuleSeed;
  destination: QuickCreateDestination;
  /** Workspace any auto-minted collection/folder lands in. */
  workspaceId: string | null;
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
  destination,
  workspaceId,
  valid = true,
  mutator,
  message,
  onClose,
}: UseQuickCreateSaveArgs): QuickCreateSaveApi {
  const t = useT();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!workspaceId) {
        message.error(t('panel.quickEditor.toast.noWorkspace'));
        return;
      }
      const writeOpts = { workspaceId, surfaceId: 'devpanel' };

      let collection = destination.collection;
      if (!collection) {
        // First rule in a collection-less workspace: mint the default
        // collection instead of bouncing the user to the workbench.
        const collectionResult = await applyCollectionCreate({ name: NEW_RULES_COLLECTION_NAME }, writeOpts);
        if (!collectionResult.ok) {
          message.error(t('panel.quickEditor.toast.collectionCreateFailed'));
          return;
        }
        collection = { uid: collectionResult.collection.uid, path: collectionResult.collection.path };
      }

      let parentPath = destination.folderPath ?? collection.path;
      if (!destination.folderPath && destination.newFolderName) {
        const folderUid = generateUid();
        const folderResult = await applyFolderCreate(
          {
            folderUid,
            parent: { type: COLLECTION_ENTITY_TYPE, uid: collection.uid },
            name: destination.newFolderName,
          },
          writeOpts,
        );
        if (folderResult.ok) {
          parentPath = `${collection.path}/${toFolderName(destination.newFolderName, folderUid)}`;
        } else {
          message.warning(t('panel.quickEditor.toast.folderCreateFailed', { name: destination.newFolderName }));
        }
      }

      const created = await mutator.createRule(buildSeed(), parentPath);
      if (!created.ok) {
        const detail = created.reason === 'other' ? created.message : undefined;
        message.error(detail ?? t('panel.quickEditor.toast.createFailed'));
        return;
      }
      const published = await mutator.publishRule(created.rule.uid);
      if (!published.ok) {
        message.warning(t('panel.quickEditor.toast.createdDraft'));
        onClose();
        return;
      }
      message.success(t('panel.quickEditor.toast.created'));
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
