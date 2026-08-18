/** Rule + rule-collection/folder CRUD, drafts, cache-bypass, and throttle RPCs. */

import { readNetworkThrottleConditions, readTabSystemOverrides } from '@openheaders/core/types';
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
import { canExecuteCspExempt } from '@openheaders/rule-engine/inject';
import { disableCacheBypassForTab, enableCacheBypassForTab } from '../../net/cache-bypass';
import { getNetworkConditionsForTab, setNetworkConditionsForTab } from '../../net/network-conditions';
import { setCdpTabPin } from '../../tabs/cdp-tab-pin';
import { getTabOverridesForTab, setTabOverridesForTab } from '../../tabs/tab-overrides';
import type { HandlerMap } from '../types';

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

  setNetworkConditions: ({ message, respond }) => {
    const tabId = message.tabId as number;
    // Validate the untrusted payload before it reaches the throttle plane —
    // an unparseable / absent profile clears any active throttle.
    const conditions = readNetworkThrottleConditions(message.conditions);
    setNetworkConditionsForTab(tabId, conditions);
    respond({ success: true });
  },

  getNetworkConditions: ({ message, respond }) => {
    const tabId = message.tabId as number;
    respond({ conditions: getNetworkConditionsForTab(tabId) });
  },

  setTabOverrides: ({ message, respond }) => {
    const tabId = message.tabId as number;
    // Validate the untrusted payload before it reaches the override plane — an
    // unparseable / absent / all-empty bag clears any active overrides.
    const overrides = readTabSystemOverrides(message.overrides);
    setTabOverridesForTab(tabId, overrides);
    respond({ success: true });
  },

  getTabOverrides: ({ message, respond }) => {
    const tabId = message.tabId as number;
    respond({ overrides: getTabOverridesForTab(tabId) });
  },

  setCdpTabPin: ({ message, respond }) => {
    const tabId = message.tabId as number;
    const pinned = !!message.pinned;
    // Synchronous pass-through into the reconciler input; the attach/detach
    // it triggers is the controller's own (async) job, surfaced on the pill.
    setCdpTabPin(tabId, pinned);
    respond({ success: true });
  },

  getCspExemptInjection: ({ respond }) => {
    // Probed at call time — the user-scripts toggle can change between
    // surface mounts, so the answer is never cached SW-side.
    respond({ available: canExecuteCspExempt() });
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
        }
        respond({ success });
      })
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  createLocalCollection: ({ message, respond }) => {
    createCollection(message.name as string)
      .then((collection) => respond({ success: true, collection }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
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
        }
        respond({ success });
      })
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },
};
