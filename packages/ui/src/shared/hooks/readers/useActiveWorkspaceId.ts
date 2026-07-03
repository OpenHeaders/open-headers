/**
 * Live-tracked active workspace id for renderer surfaces that don't
 * mount {@link RuleProvider} (devpanel popovers, awareness ribbon).
 *
 * Sources from the workspace mirror — the same singleton {@link
 * useWorkspaces} subscribes to — so updates flow uniformly on both
 * hosts. (The earlier `hostBridge.subscribe('workspaceChanged', …)`
 * path only fired on the extension; desktop never broadcasts that
 * event, which left tabs stranded on a stale active id after the
 * orchestrator flipped the pointer.)
 *
 * Returns `null` until the mirror bootstraps so callers can short-
 * circuit writes while the workspace is unknown.
 */

import { getActiveExtensionWorkspaceSyncMirror } from '@openheaders/ui/context';
import { useEffect, useState } from 'react';

export function useActiveWorkspaceId(): string | null {
  const [workspaceId, setWorkspaceId] = useState<string | null>(() =>
    getActiveExtensionWorkspaceSyncMirror().liveActiveWorkspaceId(),
  );

  useEffect(() => {
    const mirror = getActiveExtensionWorkspaceSyncMirror();
    setWorkspaceId(mirror.liveActiveWorkspaceId());
    return mirror.subscribeMirror(() => {
      setWorkspaceId(mirror.liveActiveWorkspaceId());
    });
  }, []);

  return workspaceId;
}
