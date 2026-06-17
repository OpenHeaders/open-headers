/**
 * Network-throttle presets — the panel's preset ↔ `NetworkThrottleConditions`
 * mapping that backs the toolbar dropdown. Pure logic; no chrome / rendering.
 */

import type { NetworkThrottleConditions } from '@openheaders/core/types';
import {
  conditionsForPreset,
  matchProfileKey,
  profileLabel,
  THROTTLE_PRESETS,
} from '@openheaders/ui/panel/data/network-throttle-presets';
import { describe, expect, it } from 'vitest';

describe('conditionsForPreset', () => {
  it('returns the documented Fast 4G figures', () => {
    expect(conditionsForPreset('fast-4g')).toEqual({
      offline: false,
      latencyMs: 165,
      downloadThroughputBps: 1012500,
      uploadThroughputBps: 168750,
    });
  });

  it('returns the documented Slow 4G figures', () => {
    expect(conditionsForPreset('slow-4g')).toEqual({
      offline: false,
      latencyMs: 562.5,
      downloadThroughputBps: 180000,
      uploadThroughputBps: 84375,
    });
  });

  it('returns the documented 3G figures', () => {
    expect(conditionsForPreset('3g')).toEqual({
      offline: false,
      latencyMs: 2000,
      downloadThroughputBps: 50000,
      uploadThroughputBps: 50000,
    });
  });

  it('marks Offline with offline=true', () => {
    expect(conditionsForPreset('offline').offline).toBe(true);
  });
});

describe('matchProfileKey', () => {
  it('maps null to "none"', () => {
    expect(matchProfileKey(null)).toBe('none');
  });

  it('round-trips every named preset back to its key', () => {
    for (const preset of THROTTLE_PRESETS) {
      expect(matchProfileKey(preset.conditions)).toBe(preset.key);
    }
  });

  it('maps any unmatched non-null value to "custom"', () => {
    const custom: NetworkThrottleConditions = {
      offline: false,
      latencyMs: 17,
      downloadThroughputBps: 123456,
      uploadThroughputBps: 65432,
    };
    expect(matchProfileKey(custom)).toBe('custom');
  });
});

describe('profileLabel', () => {
  it('labels the special keys', () => {
    expect(profileLabel('none')).toBe('No throttling');
    expect(profileLabel('custom')).toBe('Custom');
  });

  it('labels the named presets', () => {
    expect(profileLabel('fast-4g')).toBe('Fast 4G');
    expect(profileLabel('slow-4g')).toBe('Slow 4G');
    expect(profileLabel('3g')).toBe('3G');
    expect(profileLabel('offline')).toBe('Offline');
  });
});
