/**
 * Live-variable registry snapshot. Mirrors the service worker's
 * `buildLiveRegistry`: enabled LVs only, cache rows filtered to the
 * active environment, manual overrides honored. The renderer rebuilds
 * its own copy so the panel resolves the same values the executor will.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { isLiveVariableEffective } from '@openheaders/core/live';
import type { LiveVariable } from '@openheaders/core/types';

export interface LiveRegistryEntry {
  value: string;
  expiresAt: number | null;
  stale: boolean;
  definitionallyStale: boolean;
  workflowUid: string;
}

export type LiveRegistry = Map<string, LiveRegistryEntry>;

export interface LiveRegistryInput {
  liveVariables: LiveVariable[];
  liveCaches: Record<string, LiveWorkflowRunSnapshot[]>;
  activeEnvironmentId: string | null;
}

export function buildLiveRegistry(input: LiveRegistryInput): LiveRegistry {
  const { liveVariables, liveCaches, activeEnvironmentId } = input;
  const nowMs = Date.now();
  const registry: LiveRegistry = new Map();
  for (const lv of liveVariables) {
    if (!isLiveVariableEffective(lv)) continue;
    if (lv.manualOverride) {
      const activeOverride = lv.manualOverride.until === undefined || lv.manualOverride.until > nowMs;
      if (activeOverride) {
        registry.set(lv.name, {
          value: lv.manualOverride.value,
          expiresAt: lv.manualOverride.until ?? null,
          stale: false,
          definitionallyStale: false,
          workflowUid: lv.workflowUid,
        });
        continue;
      }
    }
    const runs = liveCaches[lv.workflowUid] ?? [];
    const run =
      runs.find((r) => r.environmentId === activeEnvironmentId) ?? runs.find((r) => r.environmentId === null) ?? null;
    if (!run) continue;
    const value = run.stepCaptures[lv.stepId]?.[lv.captureName];
    if (typeof value !== 'string') continue;
    registry.set(lv.name, {
      value,
      expiresAt: run.expiresAt,
      stale: run.expiresAt !== null && run.expiresAt < nowMs,
      definitionallyStale: run.definitionallyStale === true,
      workflowUid: lv.workflowUid,
    });
  }
  return registry;
}
