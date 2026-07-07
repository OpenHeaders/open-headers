/**
 * useScriptPackages — live script-package list for a workspace.
 *
 * Subscribes to the per-workspace script-package sync mirror directly
 * (no context provider stack — packages have exactly two consumers,
 * the Package Library tab and the save-to-package popover, both of
 * which receive an explicit workspaceId).
 */

import type { ScriptPackage } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { getScriptPackageSyncMirrorForWorkspace } from '../../../context/mirrors/script-package-sync-mirror';

export function useScriptPackages(workspaceId: string | null): ScriptPackage[] {
  const [packages, setPackages] = useState<ScriptPackage[]>([]);
  useEffect(() => {
    if (!workspaceId) {
      setPackages([]);
      return;
    }
    const mirror = getScriptPackageSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (alive) setPackages(mirror.listScriptPackages());
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeAny(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId]);
  return packages;
}
