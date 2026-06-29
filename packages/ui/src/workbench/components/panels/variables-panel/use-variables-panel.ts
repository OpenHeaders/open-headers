/**
 * Presenter hook for the Scope panel. Owns every data dependency and
 * derivation so the `VariablesPanel` container stays purely
 * presentational: it pulls each scope's source, composes the model
 * builders (context → live registry → resolver → display variables),
 * wires the Inspector → editor dispatchers, and manages the
 * in-context / all mode toggle. Returns a flat view-model.
 *
 * Resolution runs in the renderer — the SW already ships a snapshot of
 * every scope via `environmentsChanged`, so a second resolver instance
 * here stays in sync without extra RPCs.
 */

import type { Request, Rule, Template } from '@openheaders/core/types';
import type { ResolutionError } from '@openheaders/core/variables';
import { useEnvVarVault } from '@openheaders/ui/shared/hooks/useEnvVarVault';
import { useAllLiveCaches } from '@openheaders/ui/shared/hooks/useLiveCache';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { type CollectionFamilies, findCollectionByUid } from '@openheaders/ui/shared/variables';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkbenchTab } from '../../../types';
import { buildScopeEditorDispatch, buildVariableEditorDispatch, type DispatchVariable } from '../scope-editor-dispatch';
import { buildLiveRegistry } from './live-registry';
import { resolveScopeContext } from './scope-context';
import { getContextLabel, getScopeKind } from './scope-kind';
import { buildScopeResolver } from './scope-resolver';
import { buildAllScopeVariables, buildInContextVariables } from './scope-variables';
import type { AllScopeVariables, DisplayScope, DisplayVariable, ScopeKind } from './types';

export type PanelMode = 'in-context' | 'all';

/** Per-scope variables-editor openers. When present, each scope's rows
 *  + section title surface a clickable "open editor" affordance that
 *  routes to the right per-family / per-entity editor — the Inspector
 *  ties its READ surface to the WRITE surface. */
export interface VariablesPanelHandlers {
  onOpenVault?: () => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenLiveVariables?: () => void;
  /** Open a specific live-variable's edit tab. When wired, an In-Context
   *  row whose value came from a known LV uid routes here instead of the
   *  LV list page — the user lands on the edit tab for THIS variable. */
  onOpenLiveVariableEdit?: (uid: string, name: string) => void;
  onOpenEnvironmentEdit?: (uid: string, name: string) => void;
  onOpenRuleCollectionVariables?: (uid: string, name: string) => void;
  onOpenRequestCollectionVariables?: (uid: string, name: string) => void;
  onOpenTemplateCollectionVariables?: (uid: string, name: string) => void;
}

export interface VariablesPanelViewModel {
  mode: PanelMode;
  setMode: (mode: PanelMode) => void;
  scopeKind: ScopeKind;
  contextLabel: string | null;
  contextEntityName: string | null;
  hasContextEntity: boolean;
  inContextVars: DisplayVariable[];
  inContextErrors: ResolutionError[];
  allVars: AllScopeVariables;
  activeEnvironmentName: string | null;
  defaultEnvironmentName: string | null;
  activeCollectionName: string | null;
  openScopeEditor: (scope: DisplayScope) => (() => void) | null;
  openVariableEditor: (variable: DispatchVariable, name: string) => (() => void) | null;
}

export function useVariablesPanel(
  activeTab: WorkbenchTab | null,
  handlers: VariablesPanelHandlers,
): VariablesPanelViewModel {
  const {
    onOpenVault,
    onOpenWorkspaceVariables,
    onOpenLiveVariables,
    onOpenLiveVariableEdit,
    onOpenEnvironmentEdit,
    onOpenRuleCollectionVariables,
    onOpenRequestCollectionVariables,
    onOpenTemplateCollectionVariables,
  } = handlers;

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
  const contextLabel = getContextLabel(scopeKind);

  // Initialize mode to match the focused tab: a variable-referencing
  // tab starts contextual so the first thing the user sees is their
  // rule/request's own variables; otherwise fall back to "All".
  const [mode, setMode] = useState<PanelMode>(() => (getScopeKind(activeTab) === 'none' ? 'all' : 'in-context'));

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

  // Auto-apply the "natural" mode whenever the focused tab changes: a
  // rule/request tab starts in its context view; anything else starts in
  // "All". The toggle choice is per-tab — switching tabs resets to the
  // new tab's default.
  const lastTabIdRef = useRef<string | null>(activeTab?.id ?? null);
  useEffect(() => {
    const tabId = activeTab?.id ?? null;
    if (lastTabIdRef.current !== tabId) {
      lastTabIdRef.current = tabId;
      setMode(scopeKind === 'none' ? 'all' : 'in-context');
      return;
    }
    // Same tab id but its scope kind dropped to 'none' (a rare mode
    // transition on the same tab): force 'all' so the panel can't get
    // stuck showing a context view whose toggle is now hidden.
    if (scopeKind === 'none' && mode === 'in-context') setMode('all');
  }, [activeTab, scopeKind, mode]);

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

  // Inspector → editor dispatchers. Section-level uses scope only;
  // row-level prefers per-entity openers when the row carries a uid
  // (today: live rows). Both delegate to the same null-vs-callback
  // contract so the consumer hides the affordance when null.
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

  const openVariableEditor = useMemo(
    () =>
      buildVariableEditorDispatch(
        {
          onOpenVault,
          onOpenWorkspaceVariables,
          onOpenLiveVariables,
          onOpenLiveVariableEdit,
          onOpenEnvironmentEdit,
          onOpenRuleCollectionVariables,
          onOpenRequestCollectionVariables,
          onOpenTemplateCollectionVariables,
        },
        { activeCollectionId, families, activeEnvironmentId, defaultEnvironmentId, environments, liveVariables },
      ),
    [
      onOpenVault,
      onOpenWorkspaceVariables,
      onOpenLiveVariables,
      onOpenLiveVariableEdit,
      onOpenEnvironmentEdit,
      onOpenRuleCollectionVariables,
      onOpenRequestCollectionVariables,
      onOpenTemplateCollectionVariables,
      activeEnvironmentId,
      defaultEnvironmentId,
      environments,
      activeCollectionId,
      families,
      liveVariables,
    ],
  );

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
    mode,
    setMode,
    scopeKind,
    contextLabel,
    contextEntityName,
    hasContextEntity: contextEntity !== null,
    inContextVars,
    inContextErrors,
    allVars,
    activeEnvironmentName,
    defaultEnvironmentName,
    activeCollectionName,
    openScopeEditor,
    openVariableEditor,
  };
}
