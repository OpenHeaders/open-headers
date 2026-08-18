/**
 * Rule-family tab openers — draft naming, create/edit tabs, rule
 * collection/folder overviews, collection variables, and the
 * duplicate-tab scratch.
 */

import type { TelemetryRuleCreatedOrigin } from '@openheaders/core/telemetry';
import type { Collection, Rule, RuleDraft, RuleType } from '@openheaders/core/types';
import { buildEmptyRule } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { applyRuleCreate } from '@openheaders/ui/shared/sync/rule-write-client';
import { App } from 'antd';
import { useCallback } from 'react';
import { getRuleTypeLabel, resolveContextParentPath, type TabOpenerContext, type UseTabOpenersApi } from './shared';

export interface UseRuleOpenersOptions {
  rules: Rule[];
  /** Local rule collections — used to resolve the parent path when a
   *  create gesture didn't pin one explicitly. */
  localCollections: Collection[];
  /** Active workspace id — required for renderer-direct rule create. */
  workspaceId: string | null;
  /** Surface attribution carried on every emitted envelope. */
  surfaceId: string;
}

export type RuleOpeners = Pick<
  UseTabOpenersApi,
  | 'generateDraftName'
  | 'openCreateTab'
  | 'openEditTab'
  | 'openCollectionOverview'
  | 'openFolderOverview'
  | 'openCollectionVariables'
  | 'openDuplicateRuleScratch'
>;

export function useRuleOpeners(
  { rules, localCollections, workspaceId, surfaceId }: UseRuleOpenersOptions,
  { allTabs, addTab, switchTab, setPendingRenameTabId }: TabOpenerContext,
): RuleOpeners {
  const { message } = App.useApp();
  const t = useT();

  const generateDraftName = useCallback(
    (type: string) => {
      const baseName = t('workbench.shell.ruleTypeName.draftName', { name: getRuleTypeLabel(type, t) });
      const existingNames = new Set(rules.map((r) => r.name));
      for (const tab of allTabs) existingNames.add(tab.label);
      if (!existingNames.has(baseName)) return baseName;
      let counter = 2;
      while (existingNames.has(`${baseName} (${counter})`)) counter++;
      return `${baseName} (${counter})`;
    },
    [rules, allTabs, t],
  );

  /**
   * Opens a rule-creation gesture by **minting a real entity** (per
   * the sync-engine design §19.1 streaming-from-click) and
   * opening the resulting uid in an edit tab. The entity starts
   * `published: false` — the editor's Save button is the publication
   * gate.
   *
   * Heterogeneous origins, single funnel: workbench `+ New Rule`,
   * sidebar context menus, command palette, inspector "override this
   * header" CTA, popup template/new-rule, devtools-panel inline
   * create, and the `workbench.html#/create/<type>/draft-<nonce>`
   * deeplink all flow through here.
   *
   * Inputs:
   *   - `context` — pinned destination (sidebar Add Rule inside a
   *     specific collection/folder). When absent we fall back to the
   *     first local collection.
   *   - `templateKey` — pre-apply a built-in or user template inside
   *     the editor (form values applied on mount; commit happens on
   *     Save like any other edit).
   *   - `initialDraft` — inspector handoff payload. Editor merges it
   *     into form state on mount; entity itself is born from the bare
   *     `buildEmptyRule` shape so the persisted seed stays minimal.
   *
   * Fire-and-forget — the click handler returns synchronously; the
   * sync apply runs in the background and the edit tab opens on
   * success. On failure a toast surfaces; no tab is opened.
   */
  const openCreateTab = useCallback(
    (
      type: string,
      context?: { collectionId: string; folderPath?: string },
      templateKey?: string,
      initialDraft?: RuleDraft,
      origin?: TelemetryRuleCreatedOrigin,
    ) => {
      if (!workspaceId) {
        message.error(t('workbench.shell.toast.noActiveWorkspace'));
        return;
      }
      const draftMatches = initialDraft && initialDraft.type === type ? initialDraft : undefined;
      const draftName = draftMatches?.name ?? generateDraftName(type);

      // Context-create: persist immediately as 'edit' (sidebar Add Rule
      // inside a folder/collection pinned the destination). No
      // SaveToCollectionModal needed.
      const parentPath = resolveContextParentPath(context, localCollections);
      if (parentPath) {
        const seed = buildEmptyRule(type as RuleType, draftName);
        const writeOpts = { workspaceId, surfaceId, ...(origin ? { origin } : {}) };
        void applyRuleCreate({ rule: seed, parentPath }, writeOpts).then((result) => {
          if (!result.ok) {
            message.error(t('workbench.shell.toast.createRuleFailed'));
            return;
          }
          const editId = `edit-${result.rule.uid}`;
          addTab({
            id: editId,
            label: draftName,
            ruleType: type,
            // Freshly-minted entity carries the template / inspector-CTA
            // overlays as form-only state until Save commits them.
            dirty: !!templateKey || !!draftMatches,
            mode: 'edit',
            ruleUid: result.rule.uid,
            templateKey,
            initialDraft: draftMatches,
          });
          setPendingRenameTabId(editId);
        });
        return;
      }

      // No context: open an unsaved 'rule-create' draft tab. The
      // editor's Save button hands form values to `useSaveRuleFlow`,
      // which opens the SaveToCollectionModal so the user picks a
      // destination. Mirrors `openCreateRequestTab`.
      const tabId = `rule-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addTab({
        id: tabId,
        label: draftName,
        ruleType: type,
        dirty: true,
        mode: 'rule-create',
        draftName,
        templateKey,
        initialDraft: draftMatches,
        preferredCollectionId: context?.collectionId,
        preferredFolderPath: context?.folderPath,
        // The gesture's origin rides the draft tab so the eventual Save
        // (useSaveRuleFlow) attributes the create to this affordance.
        createOrigin: origin,
      });
      setPendingRenameTabId(tabId);
    },
    [workspaceId, surfaceId, localCollections, generateDraftName, addTab, message, setPendingRenameTabId, t],
  );

  const openEditTab = useCallback(
    (uid: string) => {
      const existing = allTabs.find((t) => t.mode === 'edit' && t.ruleUid === uid);
      if (existing) {
        switchTab(existing.id);
        return;
      }
      const rule = rules.find((r) => r.uid === uid);
      addTab({
        id: `edit-${uid}`,
        label: rule?.name ?? t('workbench.shell.ruleTypeName.fallback'),
        ruleType: rule?.type ?? 'header',
        dirty: false,
        mode: 'edit',
        ruleUid: uid,
      });
    },
    [allTabs, rules, addTab, switchTab, t],
  );

  const openCollectionOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `col-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'collection-overview',
        entityId: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openFolderOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `folder-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'folder-overview',
        entityId: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab, setPendingRenameTabId],
  );

  const openCollectionVariables = useCallback(
    (uid: string, name: string) => {
      const id = `coll-vars-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: t('workbench.shell.tabLabel.collectionVariables', { name }),
        ruleType: '',
        dirty: false,
        mode: 'collection-vars',
        collectionUid: uid,
      });
    },
    [allTabs, addTab, switchTab, t],
  );

  const openDuplicateRuleScratch = useCallback(
    (content: Omit<Rule, 'uid' | 'path'>, opts?: { pinnedEnvId?: string | null }) => {
      const tabId = `rule-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addTab({
        id: tabId,
        label: content.name,
        ruleType: content.type,
        dirty: true,
        mode: 'rule-create',
        draftName: content.name,
        seedRuleContent: content,
        // Duplicate carries the source tab's env pin.
        pinnedEnvId: opts?.pinnedEnvId,
      });
    },
    [addTab],
  );

  return {
    generateDraftName,
    openCreateTab,
    openEditTab,
    openCollectionOverview,
    openFolderOverview,
    openCollectionVariables,
    openDuplicateRuleScratch,
  };
}
