/**
 * use-push-window-layout — the Push window's two sashes, wired the Git
 * window's way: the persisted prefs land on the body as custom
 * properties from a layout effect — re-run on every open, since the
 * window mounts its body only while open — a drag writes the one property its
 * sash owns per pointer move, the release persists once, and a
 * double-click restores that divider's default.
 */

import type { SashSession } from '@openheaders/ui/shared/dock-layout';
import { type RefObject, useCallback, useLayoutEffect, useSyncExternalStore } from 'react';
import { shareOf, shareTrackValue } from '../git-log-layout';
import {
  filesBounds,
  PUSH_LAYOUT_DEFAULTS,
  PUSH_LAYOUT_VARS,
  type PushWindowLayoutPrefs,
  pushColumnsTemplate,
  pushFilesRowsTemplate,
  pushInfoBounds,
} from './push-window-layout';
import {
  getPushWindowLayoutPrefs,
  patchPushWindowLayoutPrefs,
  subscribePushWindowLayoutPrefs,
} from './push-window-layout-prefs';

export interface PushWindowLayoutCells {
  /** The body grid the custom properties live on. */
  body: RefObject<HTMLDivElement | null>;
  files: RefObject<HTMLDivElement | null>;
  /** The files pane below its toolbar — what the tree and the info row split. */
  filesBody: RefObject<HTMLDivElement | null>;
  info: RefObject<HTMLDivElement | null>;
}

export interface PushWindowLayout {
  columns: string;
  filesRows: string;
  beginFiles: () => SashSession | null;
  beginInfo: () => SashSession | null;
  resetFiles: () => void;
  resetInfo: () => void;
}

function applyPrefs(body: HTMLElement, prefs: PushWindowLayoutPrefs): void {
  body.style.setProperty(PUSH_LAYOUT_VARS.files, shareTrackValue(prefs.filesShare));
  body.style.setProperty(PUSH_LAYOUT_VARS.info, shareTrackValue(prefs.infoShare));
}

export function usePushWindowLayout(
  workspaceId: string,
  cells: PushWindowLayoutCells,
  open: boolean,
  showInfo: boolean,
): PushWindowLayout {
  const subscribe = useCallback(
    (listener: () => void) => subscribePushWindowLayoutPrefs(workspaceId, listener),
    [workspaceId],
  );
  const prefs = useSyncExternalStore(subscribe, () => getPushWindowLayoutPrefs(workspaceId));

  useLayoutEffect(() => {
    const body = cells.body.current;
    if (open && body) applyPrefs(body, prefs);
  }, [cells.body, prefs, open]);

  const beginFiles = useCallback((): SashSession | null => {
    const body = cells.body.current;
    const files = cells.files.current;
    if (!body || !files) return null;
    const width = body.clientWidth;
    const { min, max } = filesBounds(width);
    return {
      start: files.clientWidth,
      min,
      max,
      apply: (px) => body.style.setProperty(PUSH_LAYOUT_VARS.files, shareTrackValue(shareOf(px, width))),
      commit: (px) => patchPushWindowLayoutPrefs(workspaceId, { filesShare: shareOf(px, width) }),
    };
  }, [cells.body, cells.files, workspaceId]);

  const beginInfo = useCallback((): SashSession | null => {
    const body = cells.body.current;
    const pane = cells.filesBody.current;
    const info = cells.info.current;
    if (!body || !pane || !info || !showInfo) return null;
    const height = pane.clientHeight;
    const { min, max } = pushInfoBounds(height);
    return {
      start: info.clientHeight,
      min,
      max,
      apply: (px) => body.style.setProperty(PUSH_LAYOUT_VARS.info, shareTrackValue(shareOf(px, height))),
      commit: (px) => patchPushWindowLayoutPrefs(workspaceId, { infoShare: shareOf(px, height) }),
    };
  }, [cells.body, cells.filesBody, cells.info, showInfo, workspaceId]);

  const resetFiles = useCallback(
    () => patchPushWindowLayoutPrefs(workspaceId, { filesShare: PUSH_LAYOUT_DEFAULTS.filesShare }),
    [workspaceId],
  );
  const resetInfo = useCallback(
    () => patchPushWindowLayoutPrefs(workspaceId, { infoShare: PUSH_LAYOUT_DEFAULTS.infoShare }),
    [workspaceId],
  );

  return {
    columns: pushColumnsTemplate(),
    filesRows: pushFilesRowsTemplate(showInfo),
    beginFiles,
    beginInfo,
    resetFiles,
    resetInfo,
  };
}
