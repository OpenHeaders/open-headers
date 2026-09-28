/**
 * resolveExecutionPlacePreference — the two device-local layers folded
 * into the one role the reader takes: the request's own place (its
 * draft, else its saved value on this device) over the global row,
 * else Automatic. No synced layer exists any more — a place names
 * this device's topology.
 */

import { resolveExecutionPlacePreference } from '@openheaders/ui/workbench/execution-place/resolve-preference';
import { describe, expect, it } from 'vitest';

describe('resolveExecutionPlacePreference', () => {
  it("the request's own place wins over the global row", () => {
    expect(resolveExecutionPlacePreference('workspace-server', 'desktop-app')).toBe('workspace-server');
    expect(resolveExecutionPlacePreference('here', 'workspace-server')).toBe('here');
  });

  it('the global row applies when the request sets none, and Automatic is the floor', () => {
    expect(resolveExecutionPlacePreference(undefined, 'workspace-server')).toBe('workspace-server');
    expect(resolveExecutionPlacePreference(undefined, 'auto')).toBe('auto');
  });
});
