/**
 * Presenter hook for the Scope panel. Owns every data dependency and
 * derivation so the `VariablesPanel` container stays purely
 * presentational: it pulls each scope's source, composes the model
 * builders (context → live registry → resolver → display variables),
 * and wires the Inspector → editor dispatchers. Returns a flat
 * view-model the container renders as two collapsible sections.
 *
 * Resolution runs in the renderer — the SW already ships a snapshot of
 * every scope via `environmentsChanged`, so a second resolver instance
 * here stays in sync without extra RPCs.
 */

import type { Request, Rule, Template } from '@openheaders/core/types';
import type { ResolutionError } from '@openheaders/core/variables';
import { useEnvVarVault } from '@openheaders/ui/shared/hooks/readers/useEnvVarVault';
import { useAllLiveCaches } from '@openheaders/ui/shared/hooks/readers/useLiveCache';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/readers/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { type CollectionFamilies, findCollectionByUid } from '@openheaders/ui/shared/variables';
import { useMemo } from 'react';
import { useEnvSwitcher } from '../../../services/env-switcher';
import type { WorkbenchTab } from '../../../types';
import { buildScopeEditorDispatch } from '../scope-editor-dispatch';
import type { ScopeHeaderAction } from './ScopeSection';
import { buildLiveRegistry } from './live-registry';
import { resolveScopeContext } from './scope-context';
import { getScopeKind } from './scope-kind';
import { buildScopeResolver } from './scope-resolver';
import { buildAllScopeVariables, buildInContextVariables } from './scope-variables';
import type { AllScopeVariables, DisplayScope, DisplayVariable, ScopeKind } from './types';

/** Per-scope variables-editor openers. When present, each scope's rows
 *  + section title surface a clickable "open editor" affordance that
 *  routes to the right per-family / per-entity editor — the Inspector
 *  ties its READ surface to the WRITE surface. */
export interface VariablesPanelHandlers {
  onOpenVault?: () => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenLiveVariables?: () => void;
  /** Open a specific live-variable's edit tab. Reserved for a per-LV row
   *  handoff (see `buildVariableEditorDispatch`); the Scope panel no longer
   *  wires rows to it — In-Context rows are copy-first, not click-to-edit. */
  onOpenLiveVariableEdit?: (uid: string, name: string) => void;
  onOpenEnvironmentEdit?: (uid: string, name: string) => void;
  onOpenRuleCollectionVariables?: (uid: string, name: string) => void;
  onOpenRequestCollectionVariables?: (uid: string, name: string) => void;
  onOpenTemplateCollectionVariables?: (uid: string, name: string) => void;
  /** Mint a new environment and open its editor — backs the Environment
   *  section's "Create" affordance when no environments exist yet. */
  onCreateEnvironment?: () => void;
}

export interface VariablesPanelViewModel {
  scopeKind: ScopeKind;
  contextEntityName: string | null;
  hasContextEntity: boolean;
  inContextVars: DisplayVariable[];
  inContextErrors: ResolutionError[];
  allVars: AllScopeVariables;
  activeEnvironmentName: string | null;
  defaultEnvironmentName: string | null;
  activeCollectionName: string | null;
  openScopeEditor: (scope: DisplayScope) => (() => void) | null;
  /** Environment section's context-dependent header affordance:
   *  Edit (env selected) / Create (no envs) / Select (none active). */
  environmentAction: ScopeHeaderAction | null;
}

export function useVariablesPanel(
  activeTab: WorkbenchTab | null,
  handlers: VariablesPanelHandlers,
): VariablesPanelViewModel {
  const {
    onOpenVault,
    onOpenWorkspaceVariables,
    onOpenLiveVariables,
    onOpenEnvironmentEdit,
    onOpenRuleCollectionVariables,
    onOpenRequestCollectionVariables,
    onOpenTemplateCollectionVariables,
    onCreateEnvironment,
  } = handlers;
  const { requestEnvSelectorOpen } = useEnvSwitcher();

  const { environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault } = useEnvVarVault();
  const { rules, templates, localCollections, localCollectionTrees, templateCollections, templateCollectionTrees } =
    useRules();
  const { requests, collections: requestCollections, collectionTrees: requestCollectionTrees } = useRequests();
  const families = useMemo<CollectionFamilies>(
    () => ({ ruleCollections: localCollections, requestCollections, templateCollections }),
    [localCollections, requestCollections, templateCollections],
  );
  const { variables: liveVariables } = useLiveVariables();
  const { workflows: liveWorkflows } = useLiveWorkflows();
  const liveWorkflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches } = useAllLiveCaches(liveWorkflowUids);

  const scopeKind = useMemo(() => getScopeKind(activeTab), [activeTab]);

  const { activeRule, activeRequest, activeTemplate, activeCollectionId } = useMemo(
    () =>
      resolveScopeContext({
        activeTab,
        scopeKind,
        rules,
        requests,
        templates,
        families,
        localCollectionTrees,
        requestCollectionTrees,
        templateCollectionTrees,
      }),
    [
      scopeKind,
      activeTab,
      rules,
      requests,
      templates,
      families,
      localCollectionTrees,
      requestCollectionTrees,
      templateCollectionTrees,
    ],
  );

  const contextEntity: Rule | Request | Template | null = activeRule ?? activeRequest ?? activeTemplate;
  const contextEntityName = activeRule?.name ?? activeRequest?.name ?? activeTemplate?.name ?? null;

  const liveRegistry = useMemo(
    () => buildLiveRegistry({ liveVariables, liveCaches, activeEnvironmentId }),
    [liveVariables, liveCaches, activeEnvironmentId],
  );

  const resolver = useMemo(
    () =>
      buildScopeResolver({
        vault,
        environments,
        activeEnvironmentId,
        defaultEnvironmentId,
        workspaceVariables,
        families,
        liveRegistry,
      }),
    [vault, environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, families, liveRegistry],
  );

  const activeEnvironmentName = activeEnvironmentId
    ? (environments.find((e) => e.uid === activeEnvironmentId)?.name ?? null)
    : null;
  const defaultEnvironmentName = defaultEnvironmentId
    ? (environments.find((e) => e.uid === defaultEnvironmentId)?.name ?? null)
    : null;
  const activeCollectionName = activeCollectionId
    ? (findCollectionByUid(activeCollectionId, families)?.name ?? null)
    : null;

  // Section-level Inspector → editor dispatch: each scope's "Edit" link
  // resolves to the right per-family / per-entity editor, or null (which
  // hides the link). In-Context rows are copy-first and don't dispatch.
  const openScopeEditor = useMemo(
    () =>
      buildScopeEditorDispatch(
        {
          onOpenVault,
          onOpenWorkspaceVariables,
          onOpenLiveVariables,
          onOpenEnvironmentEdit,
          onOpenRuleCollectionVariables,
          onOpenRequestCollectionVariables,
          onOpenTemplateCollectionVariables,
        },
        { activeCollectionId, families, activeEnvironmentId, defaultEnvironmentId, environments },
      ),
    [
      onOpenVault,
      onOpenWorkspaceVariables,
      onOpenLiveVariables,
      onOpenEnvironmentEdit,
      onOpenRuleCollectionVariables,
      onOpenRequestCollectionVariables,
      onOpenTemplateCollectionVariables,
      activeEnvironmentId,
      defaultEnvironmentId,
      environments,
      activeCollectionId,
      families,
    ],
  );

  // Environment header affordance — one of three, by state:
  //   Edit   → an environment is selected (opens its editor).
  //   Create → no environments exist yet (mints the first one).
  //   Select → environments exist but none is active (opens the
  //            topbar environment selector's dropdown).
  const environmentAction = useMemo<ScopeHeaderAction | null>(() => {
    if (activeEnvironmentId) {
      const run = openScopeEditor('environment');
      return run ? { label: 'Edit', tooltip: 'Open the environment variables editor', run } : null;
    }
    if (environments.length === 0) {
      if (!onCreateEnvironment) return null;
      return { label: 'Create', tooltip: 'Create your first environment', run: onCreateEnvironment };
    }
    return { label: 'Select', tooltip: 'Choose the active environment', run: requestEnvSelectorOpen };
  }, [activeEnvironmentId, environments.length, onCreateEnvironment, openScopeEditor, requestEnvSelectorOpen]);

  const { inContextVars, inContextErrors } = useMemo(
    () => buildInContextVariables({ contextEntity, activeCollectionId, resolver, liveVariables }),
    [contextEntity, activeCollectionId, resolver, liveVariables],
  );

  const allVars = useMemo(
    () =>
      buildAllScopeVariables({
        vault,
        environments,
        activeEnvironmentId,
        workspaceVariables,
        families,
        activeCollectionId,
        liveVariables,
        liveRegistry,
      }),
    [
      vault,
      environments,
      activeEnvironmentId,
      workspaceVariables,
      families,
      activeCollectionId,
      liveVariables,
      liveRegistry,
    ],
  );

  return {
    scopeKind,
    contextEntityName,
    hasContextEntity: contextEntity !== null,
    inContextVars,
    inContextErrors,
    allVars,
    activeEnvironmentName,
    defaultEnvironmentName,
    activeCollectionName,
    openScopeEditor,
    environmentAction,
  };
}
