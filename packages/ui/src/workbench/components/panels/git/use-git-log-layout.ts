/**
 * use-git-log-layout — the Git tool window's three sashes, wired: the
 * persisted prefs land on the view root as custom properties from a
 * layout effect, a drag session writes the one property its sash owns
 * on every pointer move (no React state on that path), and the release
 * persists the result once. Double-click on a sash restores that
 * divider's default. The grid templates the view renders are the
 * model's; this hook owns the pixels.
 */

import type { SashSession } from '@openheaders/ui/shared/dock-layout';
import { type RefObject, useCallback, useLayoutEffect, useSyncExternalStore } from 'react';
import {
  detailsBounds,
  GIT_LOG_LAYOUT_DEFAULTS,
  GIT_LOG_LAYOUT_VARS,
  GIT_RAIL_STRIP_WIDTH,
  type GitLogLayoutPrefs,
  gitLogColumnsTemplate,
  gitLogDetailRowsTemplate,
  infoBounds,
  railBounds,
  railTrackValue,
  shareOf,
  shareTrackValue,
} from './git-log-layout';
import { getGitLogLayoutPrefs, patchGitLogLayoutPrefs, subscribeGitLogLayoutPrefs } from './git-log-layout-prefs';

export interface GitLogLayoutCells {
  /** The grid root the custom properties live on. */
  root: RefObject<HTMLDivElement | null>;
  rail: RefObject<HTMLDivElement | null>;
  details: RefObject<HTMLDivElement | null>;
  /** The details pane below its toolbar — what the file tree and the info row split. */
  detailBody: RefObject<HTMLDivElement | null>;
  info: RefObject<HTMLDivElement | null>;
}

export interface GitLogLayoutState {
  railCollapsed: boolean;
  showInfo: boolean;
}

export interface GitLogLayout {
  columns: string;
  detailRows: string;
  beginRail: () => SashSession | null;
  beginDetails: () => SashSession | null;
  beginInfo: () => SashSession | null;
  resetRail: () => void;
  resetDetails: () => void;
  resetInfo: () => void;
}

function applyPrefs(root: HTMLElement, prefs: GitLogLayoutPrefs): void {
  root.style.setProperty(GIT_LOG_LAYOUT_VARS.rail, railTrackValue(prefs.railWidth));
  root.style.setProperty(GIT_LOG_LAYOUT_VARS.details, shareTrackValue(prefs.detailsShare));
  root.style.setProperty(GIT_LOG_LAYOUT_VARS.info, shareTrackValue(prefs.infoShare));
}

export function useGitLogLayout(workspaceId: string, cells: GitLogLayoutCells, state: GitLogLayoutState): GitLogLayout {
  const subscribe = useCallback(
    (listener: () => void) => subscribeGitLogLayoutPrefs(workspaceId, listener),
    [workspaceId],
  );
  const prefs = useSyncExternalStore(subscribe, () => getGitLogLayoutPrefs(workspaceId));

  // Host sizes → the grid's properties. Re-applied whenever the
  // persisted prefs change (a release, a reset, another window's drag
  // on the same workspace).
  useLayoutEffect(() => {
    const root = cells.root.current;
    if (root) applyPrefs(root, prefs);
  }, [cells.root, prefs]);

  /** The width log + details split: the view minus the rail or its strip. */
  const availableWidth = useCallback((): number => {
    const root = cells.root.current;
    if (!root) return 0;
    const railWidth = state.railCollapsed ? GIT_RAIL_STRIP_WIDTH : (cells.rail.current?.clientWidth ?? 0);
    return root.clientWidth - railWidth;
  }, [cells.root, cells.rail, state.railCollapsed]);

  const beginRail = useCallback((): SashSession | null => {
    const root = cells.root.current;
    const rail = cells.rail.current;
    if (!root || !rail || state.railCollapsed) return null;
    const { min, max } = railBounds(root.clientWidth);
    return {
      start: rail.clientWidth,
      min,
      max,
      apply: (px) => root.style.setProperty(GIT_LOG_LAYOUT_VARS.rail, railTrackValue(px)),
      commit: (px) => patchGitLogLayoutPrefs(workspaceId, { railWidth: Math.round(px) }),
    };
  }, [cells.root, cells.rail, state.railCollapsed, workspaceId]);

  const beginDetails = useCallback((): SashSession | null => {
    const root = cells.root.current;
    const details = cells.details.current;
    if (!root || !details) return null;
    const available = availableWidth();
    const { min, max } = detailsBounds(available);
    return {
      start: details.clientWidth,
      min,
      max,
      apply: (px) => root.style.setProperty(GIT_LOG_LAYOUT_VARS.details, shareTrackValue(shareOf(px, available))),
      commit: (px) => patchGitLogLayoutPrefs(workspaceId, { detailsShare: shareOf(px, available) }),
    };
  }, [cells.root, cells.details, availableWidth, workspaceId]);

  const beginInfo = useCallback((): SashSession | null => {
    const root = cells.root.current;
    const body = cells.detailBody.current;
    const info = cells.info.current;
    if (!root || !body || !info || !state.showInfo) return null;
    const bodyHeight = body.clientHeight;
    const { min, max } = infoBounds(bodyHeight);
    return {
      start: info.clientHeight,
      min,
      max,
      apply: (px) => root.style.setProperty(GIT_LOG_LAYOUT_VARS.info, shareTrackValue(shareOf(px, bodyHeight))),
      commit: (px) => patchGitLogLayoutPrefs(workspaceId, { infoShare: shareOf(px, bodyHeight) }),
    };
  }, [cells.root, cells.detailBody, cells.info, state.showInfo, workspaceId]);

  const resetRail = useCallback(
    () => patchGitLogLayoutPrefs(workspaceId, { railWidth: GIT_LOG_LAYOUT_DEFAULTS.railWidth }),
    [workspaceId],
  );
  const resetDetails = useCallback(
    () => patchGitLogLayoutPrefs(workspaceId, { detailsShare: GIT_LOG_LAYOUT_DEFAULTS.detailsShare }),
    [workspaceId],
  );
  const resetInfo = useCallback(
    () => patchGitLogLayoutPrefs(workspaceId, { infoShare: GIT_LOG_LAYOUT_DEFAULTS.infoShare }),
    [workspaceId],
  );

  return {
    columns: gitLogColumnsTemplate(state.railCollapsed),
    detailRows: gitLogDetailRowsTemplate(state.showInfo),
    beginRail,
    beginDetails,
    beginInfo,
    resetRail,
    resetDetails,
    resetInfo,
  };
}
