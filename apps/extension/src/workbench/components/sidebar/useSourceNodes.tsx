import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { createElement, useMemo } from 'react';
import type { TreeNode } from './types';

interface LiveCache {
  environmentId: string | null;
  consecutiveFailures: number;
  lastExtractorOk: boolean;
}

interface UseSourceNodesParams {
  liveWorkflows: readonly { uid: string; name: string }[];
  liveVariables: readonly { workflowUid: string }[];
  liveCaches: Record<string, LiveCache[] | undefined>;
  activeEnvironmentId: string | null;
  filterText: string;
  refreshLiveWorkflow: (uid: string, environmentId: string | null) => Promise<unknown> | unknown;
  onSelectLiveWorkflow?: (uid: string, name: string) => void;
}

/**
 * Each Source is a `LiveWorkflow` — the chain + extraction rules +
 * refresh schedule that produces values. Rows get a status dot
 * derived from the run record + a count of bindings this source feeds.
 */
export function useSourceNodes(p: UseSourceNodesParams): TreeNode[] {
  const lowerFilter = p.filterText.toLowerCase();
  return useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];
    for (const wf of p.liveWorkflows) {
      if (lowerFilter && !wf.name.toLowerCase().includes(lowerFilter)) continue;
      const boundCount = p.liveVariables.filter((lv) => lv.workflowUid === wf.uid).length;
      const runs = p.liveCaches[wf.uid] ?? [];
      const run =
        runs.find((r) => r.environmentId === p.activeEnvironmentId) ??
        runs.find((r) => r.environmentId === null) ??
        runs[0] ??
        null;
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
      const id = `source-${wf.uid}`;
      const bindingsBadge =
        boundCount > 0
          ? createElement(
              'span',
              {
                style: { fontSize: 9, color: 'var(--ant-color-text-tertiary, #999)', marginLeft: 'auto' },
                title: `${boundCount} live variable${boundCount === 1 ? '' : 's'} bound to this source`,
              },
              `${boundCount} var${boundCount === 1 ? '' : 's'}`,
            )
          : undefined;
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
        badge: bindingsBadge,
        canRename: false,
        canDelete: false,
        canAddChild: false,
        onOpen: () => p.onSelectLiveWorkflow?.(wf.uid, wf.name),
        addMenuItems: [
          {
            key: 'open',
            icon: createElement(PlayCircleOutlined),
            label: 'Open source',
            onClick: () => p.onSelectLiveWorkflow?.(wf.uid, wf.name),
          },
          {
            key: 'refresh',
            icon: createElement(ReloadOutlined),
            label: 'Refresh now',
            onClick: () => void p.refreshLiveWorkflow(wf.uid, p.activeEnvironmentId),
          },
        ],
      });
    }
    return items;
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally tracks p object fields
  }, [
    p.liveWorkflows,
    p.liveVariables,
    p.liveCaches,
    p.activeEnvironmentId,
    lowerFilter,
    p.refreshLiveWorkflow,
    p.onSelectLiveWorkflow,
  ]);
}
