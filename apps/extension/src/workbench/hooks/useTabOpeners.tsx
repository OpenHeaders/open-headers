/**
 * useTabOpeners — factory for every "open a tab" entry point consumed
 * by App.tsx. Centralizes the create/edit/overview/template/run/flow
 * tab construction so App.tsx stops carrying ~300 LOC of imperative
 * handlers that only exist to route a click into the correct WorkbenchTab
 * shape.
 *
 * Also owns `pendingRenameTabId` — the "just created, focus the
 * breadcrumb for rename" hint — because every creation path that needs
 * it lives in here.
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useState } from 'react';
import type { ClosedTab, LandingView, RuleFlowScope, WorkbenchTab } from '../types';

interface UseTabOpenersOptions {
  rules: V5.Rule[];
  templates: V5.Template[];
  allTabs: WorkbenchTab[];
  addTab: (tab: WorkbenchTab) => void;
  switchTab: (tabId: string) => void;
  reopenTab?: (closed: ClosedTab) => void;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
  delay: 'Delay Rule',
  body: 'API Request Body Rule',
  mock: 'API Response Rule',
};

export function getRuleTypeLabel(type: string): string {
  return RULE_TYPE_LABELS[type] ?? 'Rule';
}

export interface UseTabOpenersApi {
  pendingRenameTabId: string | null;
  setPendingRenameTabId: (id: string | null) => void;
  generateDraftName: (type: string) => string;

  openCreateTab: (
    type: string,
    context?: { collectionId: string; folderPath?: string },
    templateKey?: string,
    initialDraft?: V5.RuleDraft,
  ) => void;
  openEditTab: (uid: string) => void;
  openCollectionOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openFolderOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openTemplateEditTab: (uid: string) => void;
  openTemplateCollectionOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openTemplateFolderOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openRunReport: (
    runId: string,
    owner?: { type: 'rule' | 'folder' | 'collection' | 'workspace'; id: string },
    ownerName?: string,
  ) => void;
  openRuleFlow: (scope: RuleFlowScope, entityId?: string, label?: string, tabUrl?: string) => void;
  openSettingsTab: (options?: { settingKey?: string; categoryId?: string }) => void;
  openLandingTab: (view: LandingView) => void;
  openWorkspaceManager: () => void;
  openEnvironmentEdit: (uid: string, name: string, autoRename?: boolean) => void;
  openWorkspaceVariables: () => void;
  openVault: () => void;
  openLiveVariables: () => void;
  openCollectionVariables: (uid: string, name: string) => void;
  openRequestEditTab: (uid: string, name: string, method?: string, autoRename?: boolean) => void;
  /**
   * Open an unsaved request draft. Mirrors `openCreateTab` for rules —
   * the tab starts dirty, nothing is persisted until the user clicks
   * Save. `context` carries the destination the user picked (sidebar
   * "Add Request" inside a collection/folder); the SaveToCollectionModal
   * fills in when no context is available.
   */
  openCreateRequestTab: (context?: { collectionId?: string; folderPath?: string }) => void;
  /** Open an existing Live Variable in a dedicated edit tab. */
  openLiveVariableEdit: (uid: string, name: string) => void;
  /** Open the workflow backing an LV in a dedicated chain editor tab. */
  openLiveWorkflowEdit: (uid: string, name: string) => void;
  /** Open an unsaved Live Variable draft with an optional seed request for the first step. */
  openCreateLiveVariable: (seedRequestUid?: string) => void;
}

export function useTabOpeners({
  rules,
  templates,
  allTabs,
  addTab,
  switchTab,
}: UseTabOpenersOptions): UseTabOpenersApi {
  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);

  const generateDraftName = useCallback(
    (type: string) => {
      const label = RULE_TYPE_LABELS[type] ?? 'Rule';
      const baseName = `New ${label}`;
      const existingNames = new Set(rules.map((r) => r.name));
      for (const tab of allTabs) existingNames.add(tab.label);
      if (!existingNames.has(baseName)) return baseName;
      let counter = 2;
      while (existingNames.has(`${baseName} (${counter})`)) counter++;
      return `${baseName} (${counter})`;
    },
    [rules, allTabs],
  );

  /**
   * Opens a rule-creation tab in `mode: 'create'` — an unsaved draft.
   * The rule is **not** persisted to the user's ruleset until they
   * explicitly Save via the editor. This contract is uniform across
   * every entry point (sidebar "Add Rule", collection/folder overview,
   * inspector-panel "override this header", keyboard shortcuts).
   *
   * Inputs the tab carries to the editor:
   *   - `templateKey` — pre-apply a built-in or user template
   *   - `initialDraft` — pre-fill from an `V5.RuleDraft` (inspector
   *     handoff, future import/paste flows)
   *   - `preferredCollectionId` / `preferredFolderPath` — if the user
   *     invoked a contextual Add Rule affordance, the Save flow
   *     writes directly to that location instead of re-asking
   *
   * Before this refactor the function wrote an empty enabled rule to
   * the user's ruleset immediately and opened an edit tab on top —
   * the draft layer was dead code. That behavior silently activated
   * rules users hadn't confirmed, which was especially jarring from
   * the inspector panel's "click to override" CTA.
   */
  const openCreateTab = useCallback(
    (
      type: string,
      context?: { collectionId: string; folderPath?: string },
      templateKey?: string,
      initialDraft?: V5.RuleDraft,
    ) => {
      const draftMatches = initialDraft && initialDraft.type === type ? initialDraft : undefined;
      const draftName = draftMatches?.name ?? generateDraftName(type);
      const tabId = `create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addTab({
        id: tabId,
        label: draftName,
        ruleType: type,
        // A freshly-opened draft is "dirty" from the start — it has
        // no saved form yet. The editor will flip it back to `false`
        // if (and only if) the user cancels every field back to the
        // type defaults, which is an edge case we're fine with.
        dirty: true,
        mode: 'create',
        createType: type,
        draftName,
        templateKey,
        initialDraft: draftMatches,
        preferredCollectionId: context?.collectionId,
        preferredFolderPath: context?.folderPath,
      });
      setPendingRenameTabId(tabId);
    },
    [generateDraftName, addTab],
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
        label: rule?.name ?? 'Rule',
        ruleType: rule?.type ?? 'header',
        dirty: false,
        mode: 'edit',
        ruleUid: uid,
        testOwnerType: 'rule',
        testOwnerId: uid,
      });
    },
    [allTabs, rules, addTab, switchTab],
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
        testOwnerType: 'collection',
        testOwnerId: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab],
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
        testOwnerType: 'folder',
        testOwnerId: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab],
  );

  const openTemplateEditTab = useCallback(
    (uid: string) => {
      const existing = allTabs.find((t) => t.mode === 'template-edit' && t.templateUid === uid);
      if (existing) {
        switchTab(existing.id);
        return;
      }
      const tpl = templates.find((t) => t.uid === uid);
      addTab({
        id: `tpl-edit-${uid}`,
        label: tpl?.name ?? 'Template',
        ruleType: tpl?.ruleType ?? '',
        dirty: false,
        mode: 'template-edit',
        templateUid: uid,
      });
    },
    [allTabs, templates, addTab, switchTab],
  );

  const openTemplateCollectionOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `tpl-col-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({ id, label: name, ruleType: '', dirty: false, mode: 'collection-overview', entityId: uid });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab],
  );

  const openTemplateFolderOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `tpl-folder-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({ id, label: name, ruleType: '', dirty: false, mode: 'folder-overview', entityId: uid });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab],
  );

  const openRunReport = useCallback(
    (
      runId: string,
      owner?: { type: 'rule' | 'folder' | 'collection' | 'workspace'; id: string },
      ownerName?: string,
    ) => {
      const id = `run-${runId}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      const label = ownerName ? `Test Run · ${ownerName}` : 'Test Run';
      addTab({
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'run-report',
        testRunId: runId,
        testOwnerType: owner?.type,
        testOwnerId: owner?.id,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openRuleFlow = useCallback(
    (scope: RuleFlowScope, entityId?: string, label?: string, tabUrl?: string) => {
      const id = entityId ? `flow-${entityId}` : `flow-${scope}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      const flowLabel = label
        ? `Flow — ${label}`
        : scope === 'all-active'
          ? 'Flow — All Active Rules'
          : 'Flow — This Page';
      addTab({
        id,
        label: flowLabel,
        ruleType: '',
        dirty: false,
        mode: 'rule-flow',
        entityId,
        flowScope: scope,
        flowTabUrl: tabUrl,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openLandingTab = useCallback(
    (view: LandingView) => {
      const id = `landing-${view}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      const label = view === 'home' ? 'Home' : view === 'rules' ? 'Rules' : 'Collections';
      addTab({
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'landing',
        landingView: view,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openSettingsTab = useCallback(
    (options?: { settingKey?: string; categoryId?: string }) => {
      const id = 'settings';
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: 'Settings',
        ruleType: '',
        dirty: false,
        mode: 'settings',
        settingsInitialKey: options?.settingKey,
        settingsInitialCategory: options?.categoryId,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openWorkspaceManager = useCallback(() => {
    const id = 'workspace-manager';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Workspaces',
      ruleType: '',
      dirty: false,
      mode: 'workspace-manager',
    });
  }, [allTabs, addTab, switchTab]);

  const openEnvironmentEdit = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `env-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        if (autoRename) setPendingRenameTabId(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'env-edit',
        environmentUid: uid,
      });
      if (autoRename) setPendingRenameTabId(id);
    },
    [allTabs, addTab, switchTab],
  );

  const openWorkspaceVariables = useCallback(() => {
    const id = 'workspace-vars';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Workspace Variables',
      ruleType: '',
      dirty: false,
      mode: 'workspace-vars',
    });
  }, [allTabs, addTab, switchTab]);

  const openVault = useCallback(() => {
    const id = 'vault';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Vault',
      ruleType: '',
      dirty: false,
      mode: 'vault',
    });
  }, [allTabs, addTab, switchTab]);

  const openLiveVariables = useCallback(() => {
    const id = 'live-vars';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Live Variables',
      ruleType: '',
      dirty: false,
      mode: 'live-vars',
    });
  }, [allTabs, addTab, switchTab]);

  const openCollectionVariables = useCallback(
    (uid: string, name: string) => {
      const id = `coll-vars-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: `${name} · Variables`,
        ruleType: '',
        dirty: false,
        mode: 'collection-vars',
        collectionUid: uid,
      });
    },
    [allTabs, addTab, switchTab],
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
    [allTabs, addTab, switchTab],
  );

  const openLiveVariableEdit = useCallback(
    (uid: string, name: string) => {
      const id = `live-var-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'live-variable-edit',
        liveVariableUid: uid,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openLiveWorkflowEdit = useCallback(
    (uid: string, name: string) => {
      const id = `live-wf-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: `${name} · Workflow`,
        ruleType: '',
        dirty: false,
        mode: 'live-workflow-edit',
        liveWorkflowUid: uid,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openCreateLiveVariable = useCallback(
    (seedRequestUid?: string) => {
      // Draft ids are timestamp-keyed so multiple new-LV tabs can
      // coexist — same pattern as `openCreateRequestTab`.
      const tabId = `live-var-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addTab({
        id: tabId,
        label: 'New Source',
        ruleType: '',
        dirty: true,
        mode: 'live-variable-create',
        liveSeedRequestUid: seedRequestUid,
      });
      setPendingRenameTabId(tabId);
    },
    [addTab],
  );

  const openCreateRequestTab = useCallback(
    (context?: { collectionId?: string; folderPath?: string }) => {
      // Generate a unique-per-workspace draft name so two "New Request"
      // drafts side-by-side get (2), (3), … suffixes. Reuses the
      // rule-draft numbering infrastructure through a type override;
      // request drafts don't collide with rule drafts because they
      // live in different stores (names are display-only either way).
      const baseName = 'New Request';
      const existingNames = new Set<string>();
      for (const tab of allTabs) existingNames.add(tab.label);
      let draftName = baseName;
      let counter = 2;
      while (existingNames.has(draftName)) {
        draftName = `${baseName} (${counter++})`;
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
    [allTabs, addTab],
  );

  return {
    pendingRenameTabId,
    setPendingRenameTabId,
    generateDraftName,
    openCreateTab,
    openEditTab,
    openCollectionOverview,
    openFolderOverview,
    openTemplateEditTab,
    openTemplateCollectionOverview,
    openTemplateFolderOverview,
    openRunReport,
    openRuleFlow,
    openSettingsTab,
    openLandingTab,
    openWorkspaceManager,
    openEnvironmentEdit,
    openWorkspaceVariables,
    openVault,
    openLiveVariables,
    openCollectionVariables,
    openRequestEditTab,
    openCreateRequestTab,
    openLiveVariableEdit,
    openLiveWorkflowEdit,
    openCreateLiveVariable,
  };
}
