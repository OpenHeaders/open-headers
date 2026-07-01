import { useMemo } from 'react';
import type { Collection, LiveWorkflow, Request, Rule } from '@openheaders/core/types';
import { isRequestResolvable, isRuleResolvable } from '@openheaders/core/utils';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import type { WorkbenchTab } from '../types';
import { useRequestScriptsReviewPending } from './useRequestScriptsReviewPending';

interface UseEntityStatusSetsOptions {
  rules: Rule[];
  localCollections: Collection[];
  requests: Request[];
  requestCollections: Collection[];
  workflows: LiveWorkflow[];
  allTabs: WorkbenchTab[];
  editingScopeWorkspaceId: string | null;
}

export interface EntityStatusSets {
  unresolvableRuleUids: Set<string>;
  unresolvableRequestUids: Set<string>;
  dirtyRuleUids: Set<string>;
  dirtyRequestUids: Set<string>;
  scriptsReviewPendingUids: ReadonlySet<string>;
  dirtyWorkflowUids: Set<string>;
  unresolvableWorkflowUids: Set<string>;
}

/**
 * Decoration sets that grey / badge sidebar + tab-strip rows. Derived
 * once at the shell level so we don't re-walk rules/requests per pill
 * render. Two families of set:
 *
 *   • unresolvable* — rules/requests/workflows whose template refs don't
 *     resolve in the active scope chain. Matches the DNR compile gate's
 *     discipline: an entity with unresolved refs can't run, so the UI
 *     treats it like draft/paused.
 *   • dirty* / scriptsReviewPending — tab-derived (tabs are the source of
 *     truth for dirty) and workspace-scoped (pending-review reminders the
 *     user clears by opening tabs).
 */
export function useEntityStatusSets({
  rules,
  localCollections,
  requests,
  requestCollections,
  workflows,
  allTabs,
  editingScopeWorkspaceId,
}: UseEntityStatusSetsOptions): EntityStatusSets {
  const variableResolver = useVariableResolver();
  const unresolvableRuleUids = useMemo(() => {
    const out = new Set<string>();
    for (const rule of rules) {
      const collectionId = localCollections.find((c) => rule.path.startsWith(`${c.path}/`))?.uid;
      const context = collectionId ? { collectionId } : undefined;
      if (
        !isRuleResolvable(
          rule,
          (name) => variableResolver.resolve(name, context),
          (name, ns) => variableResolver.resolveScopedWithDiagnostics(name, ns, context),
        )
      )
        out.add(rule.uid);
    }
    return out;
  }, [rules, localCollections, variableResolver]);
  const unresolvableRequestUids = useMemo(() => {
    const out = new Set<string>();
    for (const request of requests) {
      const owner = requestCollections.find((c) => request.path.startsWith(`${c.path}/`));
      const context = owner ? { collectionId: owner.uid } : undefined;
      if (
        !isRequestResolvable(
          request,
          (name) => variableResolver.resolve(name, context),
          (name, ns) => variableResolver.resolveScopedWithDiagnostics(name, ns, context),
        )
      )
        out.add(request.uid);
    }
    return out;
  }, [requests, requestCollections, variableResolver]);

  // Project tab-level dirty state down to per-entity sets so the
  // sidebar can mirror the tab-bar dirty dot. The tab is the source
  // of truth (`tab.dirty` is maintained by the editor via
  // `onDirtyChange`); deriving sets here keeps the Sidebar from
  // having to know tab shape. Create-mode tabs are skipped — they
  // don't map to an existing sidebar row yet.
  const dirtyRuleUids = useMemo(() => {
    const out = new Set<string>();
    for (const tab of allTabs) {
      if (tab.mode === 'edit' && tab.dirty && tab.ruleUid) out.add(tab.ruleUid);
    }
    return out;
  }, [allTabs]);
  const dirtyRequestUids = useMemo(() => {
    const out = new Set<string>();
    for (const tab of allTabs) {
      if (tab.mode === 'request-edit' && tab.dirty && tab.requestUid) out.add(tab.requestUid);
    }
    return out;
  }, [allTabs]);
  // Editing-scope: pending-script reminders are workspace-scoped state
  // the user clears by opening tabs. Diverged tab on X reads X's
  // pending list, not the global default's.
  const scriptsReviewPendingUids = useRequestScriptsReviewPending(editingScopeWorkspaceId);
  const dirtyWorkflowUids = useMemo(() => {
    const out = new Set<string>();
    for (const tab of allTabs) {
      if (tab.mode === 'live-workflow-edit' && tab.dirty && tab.liveWorkflowUid) out.add(tab.liveWorkflowUid);
    }
    return out;
  }, [allTabs]);
  // A workflow is "unresolved" if any of its step requests has
  // unresolvable template refs in the active scope chain — reuses the
  // per-request resolvability set already computed above. Structural
  // errors (cycles, unknown step refs, etc.) are NOT mixed in here;
  // those go through `isWorkflowComplete` and show as "draft".
  const unresolvableWorkflowUids = useMemo(() => {
    const out = new Set<string>();
    for (const wf of workflows) {
      for (const step of wf.steps) {
        if (step.requestUid && unresolvableRequestUids.has(step.requestUid)) {
          out.add(wf.uid);
          break;
        }
      }
    }
    return out;
  }, [workflows, unresolvableRequestUids]);

  return {
    unresolvableRuleUids,
    unresolvableRequestUids,
    dirtyRuleUids,
    dirtyRequestUids,
    scriptsReviewPendingUids,
    dirtyWorkflowUids,
    unresolvableWorkflowUids,
  };
}
