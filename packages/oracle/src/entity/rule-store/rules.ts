// ── Rules ───────────────────────────────────────────────────────────

import { buildAddBatch, buildDeleteBatch } from '@openheaders/core/sync-builders/rule-mutations';
import type { Rule } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { applyRuleMutationOrThrow } from './apply';
import { assertLoaded, collections, rules } from './state';

/**
 * Add a rule. `parentPath` is the collection or folder path.
 * `schemaVersion` is owned by the store — callers provide the feature
 * payload, the store stamps the persisted version.
 *
 * Routes through the sync oracle: emits a seed batch (one create +
 * one addToSet per set-modeled item) and awaits the broadcast-driven
 * cache refresh so the returned rule is observable from `getRules()`
 * before the function resolves.
 */
export async function addRule(rule: Omit<Rule, 'uid' | 'path' | 'schemaVersion'>, parentPath: string): Promise<Rule> {
  const uid = generateUid();
  const folderName = toFolderName(rule.name, uid);
  const created = {
    schemaVersion: 5,
    ...rule,
    uid,
    path: `${parentPath}/${folderName}`,
  } as Rule;
  await applyRuleMutationOrThrow((ctx) => buildAddBatch(created, ctx), 'addRule');
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

export async function deleteRule(uid: string): Promise<boolean> {
  assertLoaded();
  if (!rules.some((r) => r.uid === uid)) return false;
  await applyRuleMutationOrThrow((ctx) => buildDeleteBatch(uid, ctx), 'deleteRule');
  return true;
}
