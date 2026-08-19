/**
 * Destination state for the quick-create popovers — the React adapter
 * over `quick-rule-destination.ts`. The plan derives from the LIVE
 * collection trees plus the user's picker override, so a domain folder
 * minted by another save flips this popover's plan from "mint" to
 * "reuse" without any imperative sync. `forSave` is the shape
 * `useQuickCreateSave` consumes; `collectionId` scopes
 * `{{collection.X}}` suggestions to where the rule will actually live.
 */

import type { CollectionTree } from '@openheaders/core/types';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { NEW_RULES_COLLECTION_NAME } from '@openheaders/ui/shared/naming';
import { useMemo, useState } from 'react';
import {
  domainFolderName,
  type QuickDestinationOverride,
  type QuickDestinationPlan,
  resolveQuickDestination,
} from '../../data/rule-create/quick-rule-destination';
import type { QuickCreateDestination } from './use-quick-create-save';

export interface QuickCreateDestinationApi {
  plan: QuickDestinationPlan;
  override: QuickDestinationOverride | null;
  setOverride: (next: QuickDestinationOverride | null) => void;
  /** Collection trees for the picker. */
  trees: CollectionTree[];
  /** Auto-choice label for the picker ("openheaders.com"). */
  autoFolderName: string | null;
  /** Suggestion scope — the collection the rule will land in. */
  collectionId: string | undefined;
  /** Row display: "<collection> / <folder>" segments. */
  collectionLabel: string;
  collectionIsNew: boolean;
  folderLabel: string | null;
  folderIsNew: boolean;
  /** Save-hook shape. */
  forSave: QuickCreateDestination;
}

export function useQuickCreateDestination(url: string | undefined): QuickCreateDestinationApi {
  const { localCollectionTrees } = useRules();
  const [override, setOverride] = useState<QuickDestinationOverride | null>(null);

  const plan = useMemo(
    () => resolveQuickDestination(url, localCollectionTrees, override),
    [url, localCollectionTrees, override],
  );
  const autoFolderName = useMemo(() => (url ? domainFolderName(url) : null), [url]);

  return {
    plan,
    override,
    setOverride,
    trees: localCollectionTrees,
    autoFolderName,
    collectionId: plan.collection?.uid,
    collectionLabel: plan.collection?.name ?? NEW_RULES_COLLECTION_NAME,
    collectionIsNew: plan.collection === null,
    folderLabel: plan.folderLabel,
    folderIsNew: plan.newFolderName !== null,
    forSave: {
      collection: plan.collection ? { uid: plan.collection.uid, path: plan.collection.path } : null,
      folderPath: plan.folderPath,
      newFolderName: plan.newFolderName,
    },
  };
}
