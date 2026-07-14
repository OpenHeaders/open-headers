/**
 * useScriptExecutionMode — the per-workspace Safe/Developer script-mode
 * control behind the Settings tab's chooser and its runtime-managed
 * fact sheet.
 *
 * The mode is a trust decision about THIS device's runtime, so it lives
 * in the HOST-LOCAL `OH.scriptExecutionModes` slot (never a synced
 * workspace key — a synced workspace must not smuggle Developer mode
 * onto another device). The hook reads and writes that slot through the
 * host-storage seam and subscribes for live updates, so every open
 * editor reflects a change immediately.
 *
 * `available` gates the whole affordance on the `scriptRuntime`
 * capability — only a surface whose answering host actually runs
 * scripts gets a chooser; everywhere else the fact sheet keeps the
 * honest "don't run here" row. Writing `'safe'` removes the workspace's
 * entry rather than storing it: absent already reads as the default,
 * and the slot then lists exactly the workspaces that opted out of it.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  DEFAULT_SCRIPT_EXECUTION_MODE,
  readScriptExecutionMode,
  type ScriptExecutionMode,
} from '@openheaders/core/scripts';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { useCallback, useEffect, useState } from 'react';

const SCOPE = 'useScriptExecutionMode';

export interface ScriptExecutionModeControl {
  /** The answering host runs scripts — render the chooser. */
  available: boolean;
  /** The target workspace's current mode (absent entry = safe). */
  mode: ScriptExecutionMode;
  /** Rewrite the target workspace's slot entry on this device. */
  setMode: (next: ScriptExecutionMode) => void;
}

/**
 * `workspaceId` is the editing scope's workspace; `null` resolves the
 * host's active workspace (the same target the executor's slot read
 * uses for an unpinned send).
 */
export function useScriptExecutionMode(workspaceId: string | null): ScriptExecutionModeControl {
  const available = getCapability('scriptRuntime') !== undefined;
  const [modes, setModes] = useState<Record<string, ScriptExecutionMode> | undefined>(undefined);
  const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState<string | null>(workspaceId);

  useEffect(() => {
    if (workspaceId !== null) {
      setResolvedWorkspaceId(workspaceId);
      return;
    }
    const probe = getCapability('getActiveWorkspaceId');
    if (!probe) return;
    let cancelled = false;
    probe()
      .then((resp) => {
        if (!cancelled) setResolvedWorkspaceId(resp.activeWorkspaceId);
      })
      .catch((err: Error) => {
        logger.info(SCOPE, `getActiveWorkspaceId failed: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!available) return;
    const storage = getHostStorage();
    if (!storage) return;
    let cancelled = false;
    storage
      .get(OH.scriptExecutionModes)
      .then((value) => {
        if (!cancelled) setModes(value);
      })
      .catch((err: Error) => {
        logger.warn(SCOPE, `read failed: ${err.message}`);
      });
    const unsubscribe = storage.subscribe(OH.scriptExecutionModes, (next) => setModes(next));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [available]);

  const setMode = useCallback(
    (next: ScriptExecutionMode) => {
      const storage = getHostStorage();
      if (!storage || !resolvedWorkspaceId) return;
      const nextMap = { ...(modes ?? {}) };
      if (next === DEFAULT_SCRIPT_EXECUTION_MODE) {
        delete nextMap[resolvedWorkspaceId];
      } else {
        nextMap[resolvedWorkspaceId] = next;
      }
      // Optimistic — the storage subscription confirms (and corrects a
      // failed write back to the persisted value on the next change).
      setModes(nextMap);
      storage.set(OH.scriptExecutionModes, nextMap).catch((err: Error) => {
        logger.warn(SCOPE, `write failed: ${err.message}`);
      });
    },
    [modes, resolvedWorkspaceId],
  );

  return {
    available,
    mode: readScriptExecutionMode(modes, resolvedWorkspaceId),
    setMode,
  };
}
