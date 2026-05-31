/** Rule + rule-collection/folder CRUD, drafts, and cache-bypass RPCs. */

import type { TreeNode } from '@openheaders/core/types';
import { createRuleDraft, takeRuleDraft } from '@openheaders/oracle/entity/rule-draft-store';
import {
  createCollection,
  createFolder,
  deleteCollection,
  deleteFolder,
  deleteRule,
  getCollections,
  getCollectionTrees,
  getFolders,
  getRules,
  renameCollection,
  renameFolder,
} from '@openheaders/oracle/entity/rule-store';
import { pruneOrphanOwners } from '@openheaders/oracle/test-run/test-run-store';
import { disableCacheBypassForTab, enableCacheBypassForTab } from '../../cache-bypass';
import type { HandlerMap } from '../types';

/** Sweep test-run owners whose rule/collection/folder no longer exists. */
function pruneOrphanTestRunOwners(): void {
  const liveRules = new Set<string>();
  const liveEntities = new Set<string>();
  for (const r of getRules()) liveRules.add(r.uid);
  for (const c of getCollectionTrees()) {
    liveEntities.add(c.uid);
    const walk = (nodes: TreeNode[]): void => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          liveEntities.add(n.uid);
          walk(n.children);
        }
      }
    };
    walk(c.tree);
  }
  void pruneOrphanOwners(liveRules, liveEntities);
}

export const ruleHandlers: HandlerMap = {
  deleteRule: ({ message, respond, ctx }) => {
    const ruleId = message.ruleId as string;
    deleteRule(ruleId)
      .then((success) => {
        if (success) {
          // DNR recompile is handled by the sync DNR intent runner
          // (`background/sync/dnr-intent-runner.ts`) — every Rule
          // mutator emits a `RECOMPILE_DNR` intent that the runner
          // drains on the post-commit broadcast.
          ctx.updateBadgeCallback();
          pruneOrphanTestRunOwners();
        }
        respond({ success });
      })
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  createRuleDraft: ({ message, respond }) => {
    try {
      const nonce = createRuleDraft(message.draft);
      respond({ success: true, nonce });
    } catch (err) {
      respond({ success: false, error: (err as Error).message });
    }
  },

  takeRuleDraft: ({ message, respond }) => {
    const nonce = message.nonce as string;
    const draft = takeRuleDraft(nonce);
    respond({ success: true, draft });
  },

  setCacheBypass: ({ message, respond }) => {
    const tabId = message.tabId as number;
    const enabled = !!message.enabled;
    const handler = enabled ? enableCacheBypassForTab : disableCacheBypassForTab;
    handler(tabId)
      .then(() => respond({ success: true }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  getLocalRules: ({ respond }) => {
    respond({ rules: getRules() });
  },

  getLocalCollections: ({ respond }) => {
    respond({ collections: getCollections() });
  },

  getLocalCollectionTrees: ({ respond }) => {
    respond({ collectionTrees: getCollectionTrees() });
  },

  getLocalFolders: ({ respond }) => {
    respond({ folders: getFolders() });
  },

  createLocalFolder: ({ message, respond }) => {
    createFolder(message.name as string, message.parentPath as string)
      .then((folder) => respond({ success: Boolean(folder), folder: folder ?? undefined }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  renameLocalFolder: ({ message, respond }) => {
    renameFolder(message.folderUid as string, message.name as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  deleteLocalFolder: ({ message, respond, ctx }) => {
    deleteFolder(message.folderUid as string)
      .then((success) => {
        if (success) {
          // Cascade per-rule deletes flow through the oracle (see
          // rule-store.ts `deleteFolder`) and emit RECOMPILE_DNR
          // intents the runner drains.
          ctx.updateBadgeCallback();
          pruneOrphanTestRunOwners();
        }
        respond({ success });
      })
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  createLocalCollection: ({ message, respond }) => {
    const name = message.name as string;
    const collection = createCollection(name);
    respond({ success: true, collection });
  },

  renameLocalCollection: ({ message, respond }) => {
    renameCollection(message.collectionUid as string, message.name as string)
      .then((result) => respond({ success: result.ok }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  deleteLocalCollection: ({ message, respond, ctx }) => {
    deleteCollection(message.collectionUid as string)
      .then((success) => {
        if (success) {
          // Cascade rule deletes route through the oracle; runner
          // covers the DNR recompile.
          ctx.updateBadgeCallback();
          pruneOrphanTestRunOwners();
        }
        respond({ success });
      })
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },
};
