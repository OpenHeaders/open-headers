import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
} from '@openheaders/core/sync';
import type {
  Collection,
  CollectionTree,
  Environment,
  ExtensionWorkspace,
  LiveVariable,
  LiveWorkflow,
  Request,
  ResponseExample,
  Rule,
  Template,
} from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { findCollectionByPath } from '@openheaders/ui/shared/variables';
import { useCallback, useEffect, useMemo } from 'react';
import { computeBreadcrumbs, scratchLabelForMode } from '../breadcrumbs';
import type { EditorLeaf } from '../editor-groups';
import type { EnvSwitcherCollectionContext } from '../services/env-switcher';
import { useSettingValue } from '../settings/hooks';
import { type TabDisplayLookups, tabDisplayLabel } from '../tab-display';
import type { WorkbenchTab } from '../types';
import { useWorkspaceTabTitle } from './useWorkspaceTabTitle';

interface UseWorkbenchActiveTabOptions {
  focusedLeaf: EditorLeaf;
  rules: Rule[];
  templates: Template[];
  environments: Environment[];
  requests: Request[];
  localCollections: Collection[];
  requestCollections: Collection[];
  templateCollections: Collection[];
  localCollectionTrees: CollectionTree[];
  requestCollectionTrees: CollectionTree[];
  templateCollectionTrees: CollectionTree[];
  liveVariables: LiveVariable[];
  liveWorkflows: LiveWorkflow[];
  responseExamples: readonly ResponseExample[];
  workspaces: ExtensionWorkspace[];
  editingScopeWorkspaceId: string | null;
  /** Tab patcher from `useEditorGroups` — backs the env-switcher's
   *  `setActiveTabPinnedEnv` (tab pins live on the tab itself). */
  updateTab: (tabId: string, updates: Partial<WorkbenchTab>) => void;
}

interface WorkbenchActiveTab {
  activeTab: WorkbenchTab | undefined;
  activeTabEntity: { entityType: string; entityId: string } | null;
  getTabDisplayLabel: (tab: WorkbenchTab) => string;
  activeBreadcrumbSegments: string[];
  activeWorkspace: ExtensionWorkspace | undefined;
  activeTabCollectionId: string | null;
  allCollectionsForEnv: Collection[];
  envSwitcherCollectionContext: EnvSwitcherCollectionContext;
}

/**
 * Active-tab derivations — everything the shell reads off "which tab is
 * focused right now": the tab itself, its backing entity, the live
 * display-label lookup, the footer breadcrumb, the editing-scope
 * workspace, the owning collection, and the env-switcher context. Also
 * owns the shell's single `document.title` composer (the effect's only
 * consumer), so the whole "active tab → title" concern lives here.
 */
export function useWorkbenchActiveTab({
  focusedLeaf,
  rules,
  templates,
  environments,
  requests,
  localCollections,
  requestCollections,
  templateCollections,
  localCollectionTrees,
  requestCollectionTrees,
  templateCollectionTrees,
  liveVariables,
  liveWorkflows,
  responseExamples,
  workspaces,
  editingScopeWorkspaceId,
  updateTab,
}: UseWorkbenchActiveTabOptions): WorkbenchActiveTab {
  const t = useT();
  // ── Tab-title composition (`#<n> Open Headers` when ≥2 tabs) ──
  // Must mount once at the shell; subsequent route-aware title
  // mutations flow through `setBase` on this single owner so every
  // workspace tab writes the same prefix uniformly.
  const { setBase: setTabTitleBase } = useWorkspaceTabTitle();

  // ── Active tab + breadcrumbs ──────────────────────────────────
  const activeTab = useMemo(() => focusedLeaf.tabs.find((t) => t.id === focusedLeaf.activeTabId), [focusedLeaf]);

  // The active tab's backing entity, expressed as a generic
  // `(entityType, entityId)` pair the breadcrumb wraps its inline-rename
  // input with. Returns null for tab modes that don't represent a single
  // entity (settings, landing, multi-vars views) — the breadcrumb skips
  // the `<EntityField>` wrap in those cases. Adding a new editable tab
  // mode means adding its branch here; no infrastructure changes.
  const activeTabEntity = useMemo<{ entityType: string; entityId: string } | null>(() => {
    if (!activeTab) return null;
    switch (activeTab.mode) {
      case 'edit':
        return activeTab.ruleUid ? { entityType: RULE_ENTITY_TYPE, entityId: activeTab.ruleUid } : null;
      case 'request-edit':
        return activeTab.requestUid ? { entityType: REQUEST_ENTITY_TYPE, entityId: activeTab.requestUid } : null;
      case 'response-example':
        return activeTab.responseExampleUid
          ? { entityType: RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: activeTab.responseExampleUid }
          : null;
      case 'template-edit':
        return activeTab.templateUid ? { entityType: TEMPLATE_ENTITY_TYPE, entityId: activeTab.templateUid } : null;
      case 'live-variable-edit':
        return activeTab.liveVariableUid
          ? { entityType: LIVE_VARIABLE_ENTITY_TYPE, entityId: activeTab.liveVariableUid }
          : null;
      case 'live-workflow-edit':
        return activeTab.liveWorkflowUid
          ? { entityType: LIVE_WORKFLOW_ENTITY_TYPE, entityId: activeTab.liveWorkflowUid }
          : null;
      case 'env-edit':
        return activeTab.environmentUid
          ? { entityType: ENVIRONMENT_ENTITY_TYPE, entityId: activeTab.environmentUid }
          : null;
      case 'workspace-vars':
        // Singleton entity — fixed id; the publisher composes presence
        // from the editor's `useEditorDirty` + `EntityScopeProvider`.
        return { entityType: WORKSPACE_VARIABLES_ENTITY_TYPE, entityId: WORKSPACE_VARIABLES_ID };
      case 'vault':
        return { entityType: VAULT_ENTITY_TYPE, entityId: VAULT_ID };
      case 'collection-vars':
        return activeTab.collectionUid
          ? { entityType: COLLECTION_ENTITY_TYPE, entityId: activeTab.collectionUid }
          : null;
      case 'request-collection-vars':
        return activeTab.collectionUid
          ? { entityType: REQUEST_COLLECTION_ENTITY_TYPE, entityId: activeTab.collectionUid }
          : null;
      case 'template-collection-vars':
        return activeTab.collectionUid
          ? { entityType: TEMPLATE_COLLECTION_ENTITY_TYPE, entityId: activeTab.collectionUid }
          : null;
      // Create-mode tabs (no minted uid yet) deliberately return null.
      default:
        return null;
    }
  }, [activeTab]);

  // Breadcrumb for the focused-leaf active tab — rendered in the footer
  // (split editors still each have their own floating action cluster,
  // but the footer breadcrumb is single-valued and follows focus).
  // Scratch tabs (create modes before first save — the entity doesn't
  // exist in storage yet) get an extra "Scratch" segment injected before
  // the entity label so the footer matches the tab-tooltip treatment.
  // "Scratch" is chosen over "Draft" because persisted entities can also
  // hold a draft state, and the two concepts would collide.
  // Live-derived display label lookups — single source of truth for
  // every surface that wants to show an entity's current name. Used by
  // the breadcrumb (footer) and threaded into `<TabBar>` via
  // `getDisplayLabel`. Replaces the imperative `tab.label` mirror that
  // used to live in `useTabSyncEffects`; renames now flow through
  // entity-cache subscriptions and re-render the consumer.
  const tabDisplayLookups = useMemo<TabDisplayLookups>(
    () => ({
      rules,
      templates,
      environments,
      requests,
      localCollectionTrees,
      requestCollectionTrees,
      templateCollectionTrees,
      liveVariables,
      liveWorkflows,
      responseExamples,
    }),
    [
      rules,
      templates,
      environments,
      requests,
      localCollectionTrees,
      requestCollectionTrees,
      templateCollectionTrees,
      liveVariables,
      liveWorkflows,
      responseExamples,
    ],
  );
  const getTabDisplayLabel = useCallback(
    (tab: WorkbenchTab) => tabDisplayLabel(tab, tabDisplayLookups),
    [tabDisplayLookups],
  );

  const activeBreadcrumbSegments = useMemo(() => {
    if (!activeTab) return [];
    const base = computeBreadcrumbs(
      activeTab,
      getTabDisplayLabel(activeTab),
      rules,
      localCollectionTrees,
      requestCollectionTrees,
      requests,
      templateCollectionTrees,
    );
    const scratchLabel = scratchLabelForMode(activeTab.mode, t);
    if (scratchLabel && base.length >= 2) {
      return [...base.slice(0, -1), scratchLabel, base[base.length - 1]];
    }
    return base;
  }, [
    activeTab,
    getTabDisplayLabel,
    rules,
    localCollectionTrees,
    requestCollectionTrees,
    requests,
    templateCollectionTrees,
    t,
  ]);
  // Editing-scope: the StatusBar workspace pill describes what this
  // tab is editing, not what the global oracle thinks. The divergence
  // pill (separate component in the same StatusBar) carries the
  // tab-vs-default delta.
  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === editingScopeWorkspaceId),
    [workspaces, editingScopeWorkspaceId],
  );

  const activeTabCollectionId = useMemo((): string | null => {
    if (!activeTab) return null;
    const { mode } = activeTab;
    if (mode === 'collection-overview' || mode === 'folder-overview') return activeTab.entityId ?? null;
    if (mode === 'collection-vars' || mode === 'request-collection-vars' || mode === 'template-collection-vars') {
      return activeTab.collectionUid ?? null;
    }
    // Editor tabs: resolve the entity, then derive the owning
    // collection by walking the right family's path prefix. The shared
    // helper checks each family independently so a rule's path never
    // matches a request collection (or vice versa).
    const families = {
      ruleCollections: localCollections,
      requestCollections,
      templateCollections,
    };
    if (mode === 'edit' && activeTab.ruleUid) {
      const rule = rules.find((r) => r.uid === activeTab.ruleUid);
      return rule ? (findCollectionByPath(rule.path, families)?.uid ?? null) : null;
    }
    if (mode === 'request-edit' && activeTab.requestUid) {
      const req = requests.find((r) => r.uid === activeTab.requestUid);
      return req ? (findCollectionByPath(req.path, families)?.uid ?? null) : null;
    }
    if (mode === 'template-edit' && activeTab.templateUid) {
      const tmpl = templates.find((t) => t.uid === activeTab.templateUid);
      return tmpl ? (findCollectionByPath(tmpl.path, families)?.uid ?? null) : null;
    }
    if (mode === 'request-create' && activeTab.preferredCollectionId) {
      return activeTab.preferredCollectionId;
    }
    return null;
  }, [activeTab, rules, templates, localCollections, templateCollections, requests, requestCollections]);

  const collectionEnvAutoSwitch = useSettingValue('general.collectionEnvAutoSwitch');

  const allCollectionsForEnv = useMemo(
    () => [...localCollections, ...requestCollections, ...templateCollections],
    [localCollections, requestCollections, templateCollections],
  );

  // Track the active collection's default env separately so the env-
  // switcher's auto-switch effect re-runs when the user pins a new
  // default via the env-selector pin icon (vs only when they
  // navigate).
  const activeCollectionDefaultEnvId = useMemo(() => {
    if (!activeTabCollectionId) return null;
    return allCollectionsForEnv.find((c) => c.uid === activeTabCollectionId)?.defaultEnvironmentId ?? null;
  }, [activeTabCollectionId, allCollectionsForEnv]);

  // Tab pin plumbing — the pin lives on the tab itself (`pinnedEnvId`),
  // so it persists with the tab session and rides Duplicate Tab. All
  // pin writes go through the env-switcher's `setActiveTabPinnedEnv`
  // (selector row action, drop-invalid, re-point-on-pick) and target
  // the FOCUSED tab only.
  const activeTabId = activeTab?.id ?? null;
  const activeTabPinnedEnvId = activeTab?.pinnedEnvId;
  const activeTabEnvPinnable =
    activeTab?.mode === 'edit' ||
    activeTab?.mode === 'rule-create' ||
    activeTab?.mode === 'request-edit' ||
    activeTab?.mode === 'request-create';
  const setActiveTabPinnedEnv = useCallback(
    (envId: string | null | undefined) => {
      if (activeTabId) updateTab(activeTabId, { pinnedEnvId: envId });
    },
    [activeTabId, updateTab],
  );

  // Active-env policy lives in the env-switcher service. WorkbenchContent
  // hands it the workbench-specific inputs; the service owns the
  // auto-switch effect, the apply-defaults session-override map, the
  // tab-pin layer, and exposes `pickActiveEnvironment` for every UI
  // surface (sidebar, popover, env editor, command palette) via
  // `useEnvSwitcher()`.
  const envSwitcherCollectionContext = useMemo<EnvSwitcherCollectionContext>(
    () => ({
      activeTabCollectionId,
      allCollectionsForEnv,
      collectionEnvAutoSwitch,
      activeCollectionDefaultEnvId,
      // Editing-scope: env-switcher session overrides clear on tab
      // workspace change (diverged tab on X clears X's overrides), not
      // on global oracle change.
      activeWorkspaceId: editingScopeWorkspaceId,
      activeTabEnvPinnable,
      activeTabPinnedEnvId,
      setActiveTabPinnedEnv,
    }),
    [
      activeTabCollectionId,
      allCollectionsForEnv,
      collectionEnvAutoSwitch,
      activeCollectionDefaultEnvId,
      editingScopeWorkspaceId,
      activeTabEnvPinnable,
      activeTabPinnedEnvId,
      setActiveTabPinnedEnv,
    ],
  );

  // Thread the active tab label through the shell's single
  // `document.title` composer. `setTabTitleBase` handles the `#<n>`
  // prefix rule internally — callers only pass the contextual piece
  // (e.g. `my-rule — Open Headers`), so multi-tab users see titles
  // like `#2 my-rule — Open Headers`. No other component writes
  // document.title for this surface; the invariant is enforced by
  // having exactly one `useWorkspaceTabTitle` mount at the shell
  // root. Passing `null` resets to the default "Open Headers".
  useEffect(() => {
    const label = activeTab?.label?.trim();
    setTabTitleBase(label ? `${label} — Open Headers` : null);
  }, [activeTab?.label, setTabTitleBase]);

  return {
    activeTab,
    activeTabEntity,
    getTabDisplayLabel,
    activeBreadcrumbSegments,
    activeWorkspace,
    activeTabCollectionId,
    allCollectionsForEnv,
    envSwitcherCollectionContext,
  };
}
