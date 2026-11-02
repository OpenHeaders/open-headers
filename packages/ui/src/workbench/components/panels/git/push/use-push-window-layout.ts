/**
 * use-push-window-layout — the Push window's two sashes, wired the Git
 * window's way: the persisted prefs land on the body as custom
 * properties the moment the body attaches (the window portals its
 * body in after the open commit, so a callback ref is the one honest
 * mount signal) and again on every prefs change; a drag writes the one property its
 * sash owns per pointer move, the release persists once, and a
 * double-click restores that divider's default.
 */

import type { SashSession } from '@openheaders/ui/shared/dock-layout';
import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
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
  /** The body grid the custom properties live on — attached through `attachBody`. */
  body: MutableRefObject<HTMLDivElement | null>;
  files: RefObject<HTMLDivElement | null>;
  /** The files pane below its toolbar — what the tree and the info row split. */
  filesBody: RefObject<HTMLDivElement | null>;
  info: RefObject<HTMLDivElement | null>;
}

export interface PushWindowLayout {
  /** The body's ref callback: stores the element and seeds its custom properties. */
  attachBody: (element: HTMLDivElement | null) => void;
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
  showInfo: boolean,
): PushWindowLayout {
  const subscribe = useCallback(
    (listener: () => void) => subscribePushWindowLayoutPrefs(workspaceId, listener),
    [workspaceId],
  );
  const prefs = useSyncExternalStore(subscribe, () => getPushWindowLayoutPrefs(workspaceId));

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const attachBody = useCallback(
    (element: HTMLDivElement | null): void => {
      cells.body.current = element;
      if (element) applyPrefs(element, prefsRef.current);
    },
    [cells.body],
  );

  useLayoutEffect(() => {
    const body = cells.body.current;
    if (body) applyPrefs(body, prefs);
  }, [cells.body, prefs]);

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
    attachBody,
    columns: pushColumnsTemplate(),
    filesRows: pushFilesRowsTemplate(showInfo),
    beginFiles,
    beginInfo,
    resetFiles,
    resetInfo,
  };
}
