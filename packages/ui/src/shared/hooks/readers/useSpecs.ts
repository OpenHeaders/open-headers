/**
 * useSpecs — live spec list for a workspace.
 *
 * Subscribes to the per-workspace spec sync mirror directly (no context
 * provider stack — same posture as `useScriptPackages`): the sidebar
 * SPECS section and the spec editor tab both receive an explicit
 * workspaceId.
 */

import type { Spec } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { getSpecSyncMirrorForWorkspace } from '../../../context/mirrors/spec-sync-mirror';

export function useSpecs(workspaceId: string | null): Spec[] {
  const [specs, setSpecs] = useState<Spec[]>([]);
  useEffect(() => {
    if (!workspaceId) {
      setSpecs([]);
      return;
    }
    const mirror = getSpecSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (alive) setSpecs(mirror.listSpecs());
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeAny(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId]);
  return specs;
}
