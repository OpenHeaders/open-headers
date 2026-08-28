// ── Rules ───────────────────────────────────────────────────────────

import { FOLDER_ITEMS_PATH, FOLDER_TREE_KINDS, resolveTreeParent } from '@openheaders/core/sync';
import {
  buildAddBatch,
  buildDeleteBatch,
  buildDeleteEntityBatch,
} from '@openheaders/core/sync-builders/mutations/rule-mutations';
import type { Rule } from '@openheaders/core/types';
import { generateUid, parentPathOf, toFolderName } from '@openheaders/core/utils';
import { getOracleForCurrentWorkspace } from '@openheaders/oracle/sync/service/accessors';
import { childPlacement } from '../tree-placement';
import { applyRuleMutationOrThrow } from './apply';
import { assertLoaded, collections, folders, rules } from './state';

/**
 * Add a rule. `parentPath` is the collection or folder path.
 * `schemaVersion` is owned by the store — callers provide the feature
 * payload, the store stamps the persisted version.
 *
 * Routes through the sync oracle: emits a seed batch (one create +
 * one addToSet per set-modeled item + the parent's `items` slot,
 * appended after the parent's live tail) and awaits the broadcast-
 * driven cache refresh so the returned rule is observable from
 * `getRules()` before the function resolves.
 */
export async function addRule(rule: Omit<Rule, 'uid' | 'path' | 'schemaVersion'>, parentPath: string): Promise<Rule> {
  const uid = generateUid();
  const folderName = toFolderName(rule.name, uid);
  const created = {
    schemaVersion: 5,
    ...rule,
    uid,
    path: `${parentPath}/${folderName}`,
    pathSegment: folderName,
  } as Rule;
  const parent = resolveTreeParent(parentPath, { collections, folders }, FOLDER_TREE_KINDS);
  const placement = childPlacement(getOracleForCurrentWorkspace(), parent, FOLDER_ITEMS_PATH);
  await applyRuleMutationOrThrow((ctx) => buildAddBatch(created, ctx, placement), 'addRule');
  return created;
}

/**
 * Add a rule within a collection by uid. Resolves the collection path,
 * then calls `addRule`.
 */
export function addRuleToCollection(
  rule: Omit<Rule, 'uid' | 'path' | 'schemaVersion'>,
  collectionUid: string,
): Promise<Rule> {
  const collection = collections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `rules/${collectionUid}`;
  return addRule(rule, parentPath);
}

/**
 * Delete a rule: its parent's `items` slot tombstones in the same batch
 * as the entity. A parent the mirrors can't resolve (already
 * tombstoned) falls back to the bare entity tombstone — the parent's
 * own tombstone covers the slot.
 */
export async function deleteRule(uid: string): Promise<boolean> {
  assertLoaded();
  const rule = rules.find((r) => r.uid === uid);
  if (!rule) return false;
  const parentPath = parentPathOf(rule.path);
  const parent =
    parentPath === null ? null : resolveTreeParent(parentPath, { collections, folders }, FOLDER_TREE_KINDS);
  await applyRuleMutationOrThrow(
    (ctx) => (parent ? buildDeleteBatch(uid, parent, ctx) : buildDeleteEntityBatch(uid, ctx)),
    'deleteRule',
  );
  return true;
}
