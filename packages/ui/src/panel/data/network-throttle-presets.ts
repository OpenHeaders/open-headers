/**
 * Network-throttle presets for the panel toolbar dropdown (CDP Control Plane,
 * Phase F2). The panel owns the preset → `NetworkThrottleConditions` mapping;
 * the service worker only stores whatever conditions it is handed, so adding /
 * tuning a preset is a UI-only change.
 *
 * Throughputs are bytes/second. The mobile defaults (Fast 4G / Slow 4G / 3G)
 * mirror the browser's own presets; the "More presets" submenu adds wired
 * profiles (fiber / cable / DSL) and further mobile tiers (5G / 2G). All are
 * effective values — nominal link speed scaled by a real-world utilisation
 * factor. `null` conditions mean "no throttling" — the dropdown's default.
 */

import type { NetworkThrottleConditions } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

export type ThrottlePresetKey =
  | 'offline'
  | 'fiber'
  | 'cable'
  | 'dsl'
  | 'fast-5g'
  | 'slow-5g'
  | 'fast-4g'
  | 'slow-4g'
  | '3g'
  | 'fast-2g'
  | 'slow-2g';

export type ThrottleProfileKey = 'none' | 'custom' | ThrottlePresetKey;

export interface ThrottlePreset {
  readonly key: ThrottlePresetKey;
  readonly label: string;
  /** `common` presets show directly; `wired` / `mobile` live in the "More presets" submenu. */
  readonly group: 'common' | 'wired' | 'mobile';
  readonly conditions: NetworkThrottleConditions;
}

/** Every named preset. `common` ones surface directly; `wired` / `mobile` ones
 *  sit under the "More presets" submenu, in this order within each group. */
export const THROTTLE_PRESETS: readonly ThrottlePreset[] = [
  // Common — the everyday mobile defaults (browser-matched values).
  {
    key: 'fast-4g',
    label: 'Fast 4G',
    group: 'common',
    conditions: { offline: false, latencyMs: 165, downloadThroughputBps: 1012500, uploadThroughputBps: 168750 },
  },
  {
    key: 'slow-4g',
    label: 'Slow 4G',
    group: 'common',
    conditions: { offline: false, latencyMs: 562.5, downloadThroughputBps: 180000, uploadThroughputBps: 84375 },
  },
  {
    key: '3g',
    label: '3G',
    group: 'common',
    conditions: { offline: false, latencyMs: 2000, downloadThroughputBps: 50000, uploadThroughputBps: 50000 },
  },
  {
    key: 'offline',
    label: 'Offline',
    group: 'common',
    conditions: { offline: true, latencyMs: 0, downloadThroughputBps: 0, uploadThroughputBps: 0 },
  },
  // Wired / broadband.
  {
    key: 'fiber',
    label: 'Fiber',
    group: 'wired',
    conditions: { offline: false, latencyMs: 2, downloadThroughputBps: 62500000, uploadThroughputBps: 62500000 },
  },
  {
    key: 'cable',
    label: 'Cable',
    group: 'wired',
    conditions: { offline: false, latencyMs: 8, downloadThroughputBps: 25000000, uploadThroughputBps: 2500000 },
  },
  {
    key: 'dsl',
    label: 'DSL',
    group: 'wired',
    conditions: { offline: false, latencyMs: 25, downloadThroughputBps: 2500000, uploadThroughputBps: 625000 },
  },
  // Mobile — the faster (5G) and slower (2G) tiers around the defaults.
  {
    key: 'fast-5g',
    label: 'Fast 5G',
    group: 'mobile',
    conditions: { offline: false, latencyMs: 8, downloadThroughputBps: 12500000, uploadThroughputBps: 3750000 },
  },
  {
    key: 'slow-5g',
    label: 'Slow 5G',
    group: 'mobile',
    conditions: { offline: false, latencyMs: 18, downloadThroughputBps: 3750000, uploadThroughputBps: 1250000 },
  },
  {
    key: 'fast-2g',
    label: 'Fast 2G',
    group: 'mobile',
    conditions: { offline: false, latencyMs: 2000, downloadThroughputBps: 35000, uploadThroughputBps: 12500 },
  },
  {
    key: 'slow-2g',
    label: 'Slow 2G',
    group: 'mobile',
    conditions: { offline: false, latencyMs: 3000, downloadThroughputBps: 12500, uploadThroughputBps: 6250 },
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

/** Display label for the dropdown trigger given the active profile.
 *  Preset tier names (Fast 4G, Fiber, …) are raw technical vocabulary;
 *  only the none/custom states carry translated chrome. */
export function profileLabel(t: Translate, key: ThrottleProfileKey): string {
  if (key === 'none') return t('panel.throttle.none');
  if (key === 'custom') return t('panel.throttle.custom');
  return THROTTLE_PRESETS.find((p) => p.key === key)?.label ?? t('panel.throttle.none');
}
