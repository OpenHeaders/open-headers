/**
 * useLiveCache — renderer-side live view of the SW-owned WorkflowRunCache
 * blob. Surfaces per-workflow snapshots (one per environmentId the
 * workflow has run in) so the LV editor, sidebar, and inspector can
 * show last-refresh age, next-refresh countdown, and failure state
 * without each surface re-implementing the subscription.
 *
 * Two shapes:
 *   - `useLiveWorkflowCache(workflowUid)` — snapshots for ONE workflow
 *     (all envs). Re-fetches on `liveCacheChanged` with matching uid
 *     (or null, signalling workspace-wide purge) and on workspace switch.
 *   - `useAllLiveCaches()` — union across every workflow. Used by the
 *     sidebar's Live Variables section to render a status dot per row.
 *
 * Workspace seam (MWPT-FULL session #11). Both hooks accept an optional
 * `workspaceId` so a diverged workbench tab editing W2 reads W2's cache
 * even when runtime-Active is W1. Omit ⇒ SW falls back to runtime-Active
 * (system surfaces, legacy callers). Pass `useRules().activeWorkspaceId`
 * (RuleProvider's editing-scope-aware seam) at the workbench surface.
 */

import { hostBridge, type LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { useEffect, useRef, useState } from 'react';
import { useRules } from './useRules';

export function useLiveWorkflowCache(workflowUid: string | null | undefined): {
  runs: LiveWorkflowRunSnapshot[];
  isReady: boolean;
  reload: () => Promise<void>;
} {
  const { activeWorkspaceId } = useRules();
  const wsId = activeWorkspaceId ?? undefined;
  const [runs, setRuns] = useState<LiveWorkflowRunSnapshot[]>([]);
  const [isReady, setIsReady] = useState(false);

  const reloadRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    let cancelled = false;
    if (!workflowUid) {
      setRuns([]);
      setIsReady(true);
      return;
    }

    const load = async () => {
      const resp = await hostBridge
        .call('getLiveCacheForWorkflow', { workflowUid, workspaceId: wsId })
        .catch(() => null);
      if (cancelled) return;
      setRuns(resp?.runs ?? []);
      setIsReady(true);
    };
    reloadRef.current = load;
    void load();

    const unsubCache = hostBridge.subscribe('liveCacheChanged', (payload) => {
      if (payload.workflowUid === null || payload.workflowUid === workflowUid) void load();
    });
    const unsubWs = hostBridge.subscribe('workspaceChanged', () => void load());

    return () => {
      cancelled = true;
      unsubCache();
      unsubWs();
    };
  }, [workflowUid, wsId]);

  return { runs, isReady, reload: () => reloadRef.current() };
}

/**
 * Union of every workflow's run snapshots for the editing-scope
 * workspace. `byWorkflowUid` is keyed by workflow uid; each value is
 * the array of per-environment run snapshots for that workflow.
 */
export function useAllLiveCaches(workflowUids: string[]): {
  byWorkflowUid: Record<string, LiveWorkflowRunSnapshot[]>;
  isReady: boolean;
} {
  const { activeWorkspaceId } = useRules();
  const wsId = activeWorkspaceId ?? undefined;
  const [byWorkflowUid, setByWorkflowUid] = useState<Record<string, LiveWorkflowRunSnapshot[]>>({});
  const [isReady, setIsReady] = useState(false);

  // Join the uids into a stable signature so the effect only re-runs
  // when the SET of workflows changes (identity on the passed array
  // is otherwise a new reference per parent render).
  const signature = workflowUids.slice().sort().join('|');

  useEffect(() => {
    let cancelled = false;
    const uids = signature ? signature.split('|') : [];

    const loadAll = async () => {
      const entries = await Promise.all(
        uids.map(async (uid) => {
          const resp = await hostBridge.call('getLiveCacheForWorkflow', { workflowUid: uid, workspaceId: wsId }).catch(
            () => null,
          );
          return [uid, resp?.runs ?? []] as const;
        }),
      );
      if (cancelled) return;
      const next: Record<string, LiveWorkflowRunSnapshot[]> = {};
      for (const [uid, runs] of entries) next[uid] = runs;
      setByWorkflowUid(next);
      setIsReady(true);
    };
    void loadAll();

    const unsubCache = hostBridge.subscribe('liveCacheChanged', () => void loadAll());
    const unsubWs = hostBridge.subscribe('workspaceChanged', () => void loadAll());

    return () => {
      cancelled = true;
      unsubCache();
      unsubWs();
    };
  }, [signature, wsId]);

  return { byWorkflowUid, isReady };
}
