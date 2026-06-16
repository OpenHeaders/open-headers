/**
 * Network-throttle presets for the panel toolbar dropdown (CDP Control Plane,
 * Phase F2). The panel owns the preset → `NetworkThrottleConditions` mapping;
 * the service worker only stores whatever conditions it is handed, so adding /
 * tuning a preset is a UI-only change.
 *
 * Throughputs are bytes/second. The 3G figures are the widely-used effective
 * values (nominal link speed scaled by a real-world utilisation factor):
 * Slow 3G ≈ 400 kbit/s, Fast 3G ≈ 1.44 Mbit/s down. `null` conditions mean
 * "no throttling" — the dropdown's default.
 */

import type { NetworkThrottleConditions } from '@openheaders/core/types';

export type ThrottleProfileKey = 'none' | 'offline' | 'slow-3g' | 'fast-3g' | 'custom';

export interface ThrottlePreset {
  readonly key: 'offline' | 'slow-3g' | 'fast-3g';
  readonly label: string;
  readonly conditions: NetworkThrottleConditions;
}

export const NO_THROTTLE_LABEL = 'No throttling';
export const CUSTOM_LABEL = 'Custom';

/** The named presets, in dropdown order under the "Presets" group. */
export const THROTTLE_PRESETS: readonly ThrottlePreset[] = [
  {
    key: 'slow-3g',
    label: 'Slow 3G',
    conditions: { offline: false, latencyMs: 2000, downloadThroughputBps: 50000, uploadThroughputBps: 50000 },
  },
  {
    key: 'fast-3g',
    label: 'Fast 3G',
    conditions: { offline: false, latencyMs: 562.5, downloadThroughputBps: 180000, uploadThroughputBps: 84375 },
  },
  {
    key: 'offline',
    label: 'Offline',
    conditions: { offline: true, latencyMs: 0, downloadThroughputBps: 0, uploadThroughputBps: 0 },
  },
];

function conditionsEqual(a: NetworkThrottleConditions, b: NetworkThrottleConditions): boolean {
  return (
    a.offline === b.offline &&
    a.latencyMs === b.latencyMs &&
    a.downloadThroughputBps === b.downloadThroughputBps &&
    a.uploadThroughputBps === b.uploadThroughputBps
  );
}

/** Conditions for a named preset, or `null` for "no throttling". */
export function conditionsForPreset(key: ThrottlePreset['key']): NetworkThrottleConditions {
  const preset = THROTTLE_PRESETS.find((p) => p.key === key);
  if (!preset) throw new Error(`Unknown throttle preset: ${key}`);
  return preset.conditions;
}

/** Which profile a stored conditions value represents — a named preset when it
 *  matches one exactly, `'custom'` for any other non-null value, `'none'` for null. */
export function matchProfileKey(conditions: NetworkThrottleConditions | null): ThrottleProfileKey {
  if (conditions === null) return 'none';
  const preset = THROTTLE_PRESETS.find((p) => conditionsEqual(p.conditions, conditions));
  return preset ? preset.key : 'custom';
}

/** Display label for the dropdown trigger given the active profile. */
export function profileLabel(key: ThrottleProfileKey): string {
  if (key === 'none') return NO_THROTTLE_LABEL;
  if (key === 'custom') return CUSTOM_LABEL;
  return THROTTLE_PRESETS.find((p) => p.key === key)?.label ?? NO_THROTTLE_LABEL;
}
