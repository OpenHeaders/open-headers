/**
 * Request-family tab openers — collection/folder overviews, collection
 * variables, edit tabs, the unsaved-draft create path, and the
 * duplicate-tab scratch.
 */

import type { Collection, Request } from '@openheaders/core/types';
import { buildEmptyGrpcRequest, buildEmptyRequest, generateUid, toFolderName } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { applyGrpcRequestCreate } from '@openheaders/ui/shared/sync/grpc-request-write-client';
import { applyRequestCreate } from '@openheaders/ui/shared/sync/request-write-client';
import { useCallback } from 'react';
import { resolveContextParentPath, type TabOpenerContext, type UseTabOpenersApi } from './shared';

export interface UseRequestOpenersOptions {
  /** Request collections — used to resolve the parent path for
   *  request context-create gestures. */
  requestCollections: Collection[];
  /** Active workspace id — required for renderer-direct request create. */
  workspaceId: string | null;
  /** Surface attribution carried on every emitted envelope. */
  surfaceId: string;
}

export type RequestOpeners = Pick<
  UseTabOpenersApi,
  | 'openRequestCollectionOverview'
  | 'openRequestFolderOverview'
  | 'openRequestCollectionVariables'
  | 'openRequestCollectionScripts'
  | 'openRequestFolderScripts'
  | 'openRequestCollectionAuth'
  | 'openRequestFolderAuth'
  | 'openRequestEditTab'
  | 'openCreateRequestTab'
  | 'openGrpcRequestEditTab'
  | 'openCreateGrpcRequestTab'
  | 'openDuplicateRequestScratch'
  | 'openResponseExampleTab'
  | 'openGrpcResponseExampleTab'
>;

export function useRequestOpeners(
  { requestCollections, workspaceId, surfaceId }: UseRequestOpenersOptions,
  { allTabs, addTab, switchTab, setPendingRenameTabId }: TabOpenerContext,
): RequestOpeners {
  const t = useT();
  const openRequestCollectionOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `req-col-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({ id, label: name, ruleType: '', dirty: false, mode: 'collection-overview', entityId: uid });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openRequestFolderOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `req-folder-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({ id, label: name, ruleType: '', dirty: false, mode: 'folder-overview', entityId: uid });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openRequestCollectionVariables = useCallback(
    (uid: string, name: string) => {
      const id = `req-coll-vars-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: t('workbench.shell.tabLabel.collectionVariables', { name }),
        ruleType: '',
        dirty: false,
        mode: 'request-collection-vars',
        collectionUid: uid,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

  const openRequestCollectionScripts = useCallback(
    (uid: string, name: string) => {
      const id = `req-coll-scripts-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: t('workbench.shell.tabLabel.collectionScripts', { name }),
        ruleType: '',
        dirty: false,
        mode: 'request-collection-scripts',
        entityId: uid,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

  const openRequestFolderScripts = useCallback(
    (uid: string, name: string) => {
      const id = `req-folder-scripts-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: t('workbench.shell.tabLabel.collectionScripts', { name }),
        ruleType: '',
        dirty: false,
        mode: 'request-folder-scripts',
        entityId: uid,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

  const openRequestCollectionAuth = useCallback(
    (uid: string, name: string) => {
      const id = `req-coll-auth-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: t('workbench.shell.tabLabel.collectionAuth', { name }),
        ruleType: '',
        dirty: false,
        mode: 'request-collection-auth',
        entityId: uid,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

  const openRequestFolderAuth = useCallback(
    (uid: string, name: string) => {
      const id = `req-folder-auth-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: t('workbench.shell.tabLabel.collectionAuth', { name }),
        ruleType: '',
        dirty: false,
        mode: 'request-folder-auth',
        entityId: uid,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

  const openRequestEditTab = useCallback(
    (uid: string, name: string, method = 'GET', autoRename = false) => {
      const id = `request-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        if (autoRename) setPendingRenameTabId(id);
        return;
      }
      addTab({
        id,
        label: name,
        // ruleType reused as a free-form "type hint" for the tab icon;
        // using the HTTP method keeps the tab bar visually parseable.
        ruleType: method,
        dirty: false,
        mode: 'request-edit',
        requestUid: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openCreateRequestTab = useCallback(
    (context?: { collectionId?: string; folderPath?: string }) => {
      // Generate a unique-per-workspace draft name so two "New Request"
      // drafts side-by-side get (2), (3), … suffixes. Reuses the
      // rule-draft numbering infrastructure through a type override;
      // request drafts don't collide with rule drafts because they
      // live in different stores (names are display-only either way).
      const baseName = t('workbench.shell.tabLabel.newRequest');
      const existingNames = new Set<string>();
      for (const tab of allTabs) existingNames.add(tab.label);
      let draftName = baseName;
      let counter = 2;
      while (existingNames.has(draftName)) {
        draftName = `${baseName} (${counter++})`;
      }

      // Context-create: persist immediately and open as 'request-edit'
      // (mirrors the rule context-create path). The tab is born clean
      // — dirty=false, no orange dot, Save labeled "Saved" disabled.
      // Without context the gesture lands in the draft 'request-create'
      // mode below, whose Save click runs the where-to-save modal.
      const parentPath = resolveContextParentPath(context, requestCollections);
      if (workspaceId && parentPath) {
        const uid = generateUid();
        const seed = buildEmptyRequest({
          uid,
          name: draftName,
          path: `${parentPath}/${toFolderName(draftName, uid)}`,
        });
        const tabId = `request-${uid}`;
        void applyRequestCreate(seed, { workspaceId, surfaceId }).then((result) => {
          if (!result.ok) return;
          addTab({ id: tabId, label: draftName, ruleType: 'GET', dirty: false, mode: 'request-edit', requestUid: uid });
          setPendingRenameTabId(tabId);
        });
        return;
      }

      const tabId = `req-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addTab({
        id: tabId,
        label: draftName,
        // Draft tabs default to GET — the tab icon uses `ruleType` as
        // the method hint, which flips once the user changes it.
        ruleType: 'GET',
        dirty: true,
        mode: 'request-create',
        draftName,
        preferredCollectionId: context?.collectionId,
        preferredFolderPath: context?.folderPath,
      });
      setPendingRenameTabId(tabId);
    },
    [allTabs, addTab, requestCollections, workspaceId, surfaceId, setPendingRenameTabId, t],
  );

  const openGrpcRequestEditTab = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `grpc-request-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        if (autoRename) setPendingRenameTabId(id);
        return;
      }
      addTab({
        id,
        label: name,
        // Tab icon reads `ruleType` as a free-form type hint — the
        // gRPC tag mirrors the sidebar leaf tag.
        ruleType: 'gRPC',
        dirty: false,
        mode: 'grpc-edit',
        grpcRequestUid: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openCreateGrpcRequestTab = useCallback(
    (context: { collectionId?: string; folderPath?: string }) => {
      // Context-create only — no draft mode: the gesture always comes
      // from a container's "+" menu, so the destination is known and
      // the entity persists immediately (born clean, like the rule
      // context-create path).
      const parentPath = resolveContextParentPath(context, requestCollections);
      if (!workspaceId || !parentPath) return;
      const baseName = t('workbench.shell.tabLabel.newGrpcRequest');
      const existingNames = new Set<string>();
      for (const tab of allTabs) existingNames.add(tab.label);
      let draftName = baseName;
      let counter = 2;
      while (existingNames.has(draftName)) {
        draftName = `${baseName} (${counter++})`;
      }
      const uid = generateUid();
      const seed = buildEmptyGrpcRequest({
        uid,
        name: draftName,
        path: `${parentPath}/${toFolderName(draftName, uid)}`,
      });
      const tabId = `grpc-request-${uid}`;
      void applyGrpcRequestCreate(seed, { workspaceId, surfaceId }).then((result) => {
        if (!result.ok) return;
        addTab({
          id: tabId,
          label: draftName,
          ruleType: 'gRPC',
          dirty: false,
          mode: 'grpc-edit',
          grpcRequestUid: uid,
        });
        setPendingRenameTabId(tabId);
      });
    },
    [allTabs, addTab, requestCollections, workspaceId, surfaceId, setPendingRenameTabId, t],
  );

  const openDuplicateRequestScratch = useCallback(
    (
      content: Omit<Request, 'uid' | 'path' | 'schemaVersion'>,
      opts?: { pinnedEnvId?: string | null; fromExampleName?: string },
    ) => {
      const tabId = `req-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addTab({
        id: tabId,
        label: content.name,
        // Tab icon reads `ruleType` as the method hint for requests.
        ruleType: content.method,
        dirty: true,
        mode: 'request-create',
        draftName: content.name,
        seedRequestContent: content,
        // Duplicate carries the source tab's env pin — the prod/staging
        // duplicate flow pins each copy to its own environment.
        pinnedEnvId: opts?.pinnedEnvId,
        // "Try" forks from a frozen example — chrome-only provenance.
        seedFromExampleName: opts?.fromExampleName,
      });
    },
    [addTab],
  );

  const openResponseExampleTab = useCallback(
    (uid: string, name: string, requestUid: string) => {
      // Matches the sidebar example-node id so the active tab drives
      // the row highlight without extra selection plumbing.
      const id = `resp-example-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'response-example',
        responseExampleUid: uid,
        requestUid,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openGrpcResponseExampleTab = useCallback(
    (uid: string, name: string, grpcRequestUid: string) => {
      // Matches the sidebar example-node id so the active tab drives
      // the row highlight without extra selection plumbing.
      const id = `grpc-example-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'grpc-response-example',
        grpcResponseExampleUid: uid,
        grpcRequestUid,
      });
    },
    [allTabs, addTab, switchTab],
  );

  return {
    openRequestCollectionOverview,
    openRequestFolderOverview,
    openRequestCollectionVariables,
    openRequestCollectionScripts,
    openRequestFolderScripts,
    openRequestCollectionAuth,
    openRequestFolderAuth,
    openRequestEditTab,
    openCreateRequestTab,
    openGrpcRequestEditTab,
    openCreateGrpcRequestTab,
    openDuplicateRequestScratch,
    openResponseExampleTab,
    openGrpcResponseExampleTab,
  };
}
