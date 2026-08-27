/**
 * useTrustedRoots — live trust list for a workspace.
 *
 * Subscribes to the per-workspace trusted-roots sync mirror directly
 * (the `useScriptPackages` shape — no context provider stack; the
 * editor tab body hands its editing-scope workspaceId down).
 */

import type { TrustedRoot } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { getTrustedRootsSyncMirrorForWorkspace } from '../../../context/mirrors/trusted-roots-sync-mirror';

const NO_ROOTS: TrustedRoot[] = [];

export function useTrustedRoots(workspaceId: string | null): TrustedRoot[] {
  const [roots, setRoots] = useState<TrustedRoot[]>(NO_ROOTS);
  useEffect(() => {
    if (!workspaceId) {
      setRoots(NO_ROOTS);
      return;
    }
    const mirror = getTrustedRootsSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (alive) setRoots(mirror.liveRoots());
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeMirror(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId]);
  return roots;
}
