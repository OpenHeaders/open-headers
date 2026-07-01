import { isWorkflowComplete, isWorkflowDraft } from '@openheaders/core/live';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveWorkflow } from '@openheaders/core/types';
import { createElement, useMemo } from 'react';
import type { WorkbenchTab } from '../../types';
import { exportNodeFields } from './export-fields';
import { composeBadge } from './icons';
import type { TreeNode } from './types';
import type { SidebarExportEntity } from '../workspace-export/build-export-scope';

interface LiveCache {
  environmentId: string | null;
  consecutiveFailures: number;
  lastExtractorOk: boolean;
}

interface UseWorkflowNodesParams {
  liveWorkflows: readonly LiveWorkflow[];
  liveVariables: readonly { workflowUid: string }[];
  liveCaches: Record<string, LiveCache[] | undefined>;
  activeEnvironmentId: string | null;
  filterText: string;
  refreshLiveWorkflow: (uid: string, environmentId: string | null) => Promise<unknown> | unknown;
  onSelectLiveWorkflow?: (uid: string, name: string) => void;
  /** Rename a workflow — threaded from `useLiveWorkflows().updateWorkflow`. */
  renameWorkflow: (uid: string, name: string) => Promise<unknown> | unknown;
  /** Delete a workflow — threaded from `useLiveWorkflows().deleteWorkflow`. */
  deleteWorkflow: (uid: string) => Promise<unknown> | unknown;
  /** Confirm-delete helper from the Sidebar (respects the user's
   *  "confirm on delete" setting + shared Modal.confirm styling). */
  confirmDelete: (name: string, onConfirm: () => void) => void;
  /** Unsaved `live-workflow-create` tabs — rendered at the top of the list. */
  workflowDrafts?: readonly WorkbenchTab[];
  buildWorkflowDraftNode?: (tab: WorkbenchTab) => TreeNode;
  /** Workflow uids with an open edit tab carrying unsaved changes. */
  dirtyWorkflowUids?: ReadonlySet<string>;
  /** Workflow uids with step-request templates that don't resolve. */
  unresolvableWorkflowUids?: ReadonlySet<string>;
  onExportEntity?: (entity: SidebarExportEntity) => void;
}

/**
 * Each row is a `LiveWorkflow` — the chain + extraction rules + refresh
 * schedule that produces values for `{{live.NAME}}` references.
 *
 * Row signal layering (parallel to the rules sidebar):
 *   - Runtime dot icon — green / yellow / red / idle from the last run
 *     record. Dynamic state that rules don't have (rules are DNR-
 *     compiled, stateless from the sidebar's POV).
 *   - Text badge (precedence): `draft` → `unresolved` → `off`.
 *     Matches rules' configuration-state badge vocabulary.
 *   - Dirty dot — overlayed via `composeBadge` when the workflow has an
 *     open edit tab with unsaved changes.
 *   - Bindings count — trailing "N var(s)" secondary label.
 *
 * Unsaved drafts (create-mode tabs not yet persisted) land at the top
 * via the `workflowDrafts` + `buildWorkflowDraftNode` params.
 */
export function useWorkflowNodes(p: UseWorkflowNodesParams): TreeNode[] {
  const lowerFilter = p.filterText.toLowerCase();
  return useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];
    // Unsaved workflow drafts land first so users see their in-flight
    // work above the saved list (same as rules / requests).
    if (p.workflowDrafts && p.buildWorkflowDraftNode) {
      for (const draft of p.workflowDrafts) {
        const label = draft.draftName ?? draft.label;
        if (lowerFilter && !label.toLowerCase().includes(lowerFilter)) continue;
        items.push(p.buildWorkflowDraftNode(draft));
      }
    }
    for (const wf of p.liveWorkflows) {
      if (lowerFilter && !wf.name.toLowerCase().includes(lowerFilter)) continue;
      const boundCount = p.liveVariables.filter((lv) => lv.workflowUid === wf.uid).length;
      const runs = p.liveCaches[wf.uid] ?? [];
      const run =
        runs.find((r) => r.environmentId === p.activeEnvironmentId) ??
        runs.find((r) => r.environmentId === null) ??
        runs[0] ??
        null;

      // Runtime health dot — dynamic per-run state.
      let level: 'green' | 'yellow' | 'red' | 'idle' = 'idle';
      if (run) {
        if (run.consecutiveFailures >= 5) level = 'red';
        else if (run.consecutiveFailures >= 1 || !run.lastExtractorOk) level = 'yellow';
        else level = 'green';
      }
      const dotColor =
        level === 'green'
          ? 'var(--ant-color-success, #52c41a)'
          : level === 'yellow'
            ? 'var(--ant-color-warning, #faad14)'
            : level === 'red'
              ? 'var(--ant-color-error, #ff4d4f)'
              : 'var(--ant-color-text-tertiary, #999)';

      // Configuration-state badge, precedence matches rules.
      // Draft (publication gate) and incomplete (data-shape) are
      // orthogonal — same model as session 55's Rule sidebar tags.
      // Precedence: incomplete > unresolved > draft > off, so the most
      // actionable issue wins the single badge slot.
      const complete = isWorkflowComplete(wf);
      const draft = isWorkflowDraft(wf);
      const isUnresolved = complete && (p.unresolvableWorkflowUids?.has(wf.uid) ?? false);
      let textBadge: { label: string; color: string } | null = null;
      if (!complete) {
        textBadge = { label: 'incomplete', color: 'var(--ant-color-text-tertiary, #999)' };
      } else if (isUnresolved) {
        textBadge = { label: 'unresolved', color: 'var(--ant-color-error, #ff4d4f)' };
      } else if (draft) {
        textBadge = { label: 'draft', color: 'var(--ant-color-text-tertiary, #999)' };
      } else if (!wf.enabled) {
        textBadge = { label: 'off', color: 'var(--ant-color-text-tertiary, #999)' };
      }
      const stateBadge = composeBadge(textBadge, p.dirtyWorkflowUids?.has(wf.uid) ?? false);

      // Bindings count — a secondary, quieter badge that sits after the
      // state badge when both render, so the state signal wins visually.
      const bindingsNode =
        boundCount > 0
          ? createElement(
              'span',
              {
                key: 'bindings',
                style: { fontSize: 9, color: 'var(--ant-color-text-tertiary, #999)' },
                title: `${boundCount} live variable${boundCount === 1 ? '' : 's'} bound to this workflow`,
              },
              `${boundCount} var${boundCount === 1 ? '' : 's'}`,
            )
          : null;

      const badge =
        stateBadge && bindingsNode
          ? createElement(
              'span',
              { style: { marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' } },
              bindingsNode,
              stateBadge,
            )
          : (stateBadge ??
            (bindingsNode
              ? createElement(
                  'span',
                  { style: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' } },
                  bindingsNode,
                )
              : undefined));

      const id = `workflow-${wf.uid}`;
      items.push({
        id,
        kind: 'leaf',
        label: wf.name,
        depth: 0,
        expandable: false,
        icon: createElement('span', {
          style: {
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            marginRight: 2,
          },
        }),
        badge,
        canRename: true,
        canDelete: true,
        canAddChild: false,
        onOpen: () => p.onSelectLiveWorkflow?.(wf.uid, wf.name),
        onRename: async (name: string) => {
          await p.renameWorkflow(wf.uid, name);
        },
        onDelete: () =>
          p.confirmDelete(wf.name, () => {
            void p.deleteWorkflow(wf.uid);
          }),
        ...exportNodeFields({ kind: 'liveWorkflow', uid: wf.uid, name: wf.name }, p.onExportEntity),
        awareness: { entityType: LIVE_WORKFLOW_ENTITY_TYPE, entityId: wf.uid },
      });
    }
    return items;
  }, [
    p.liveWorkflows,
    p.liveVariables,
    p.liveCaches,
    p.activeEnvironmentId,
    lowerFilter,
    p.onSelectLiveWorkflow,
    p.renameWorkflow,
    p.deleteWorkflow,
    p.confirmDelete,
    p.workflowDrafts,
    p.buildWorkflowDraftNode,
    p.dirtyWorkflowUids,
    p.unresolvableWorkflowUids,
    p.onExportEntity,
  ]);
}
