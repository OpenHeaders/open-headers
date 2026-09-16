/**
 * resolveExecutionPlacePreference — fork 3's three layers folded into
 * the one role the reader takes: the per-send pick over the request's
 * own knob, over the nearest ancestor's, over the global row, else
 * Automatic.
 */

import { resolveExecutionPlacePreference } from '@openheaders/ui/workbench/execution-place/resolve-preference';
import { describe, expect, it } from 'vitest';

describe('resolveExecutionPlacePreference', () => {
  it('the per-send pick wins over every layer', () => {
    expect(
      resolveExecutionPlacePreference(
        'here',
        'workspace-server',
        { settings: { executionPlace: 'desktop-app' } },
        'desktop-app',
      ),
    ).toBe('here');
  });

  it("the request's own knob wins over the chain and the global row", () => {
    expect(
      resolveExecutionPlacePreference(
        'auto',
        'workspace-server',
        { settings: { executionPlace: 'desktop-app' } },
        'here',
      ),
    ).toBe('workspace-server');
  });

  it("the nearest ancestor's knob wins over the global row", () => {
    expect(
      resolveExecutionPlacePreference('auto', undefined, { settings: { executionPlace: 'desktop-app' } }, 'here'),
    ).toBe('desktop-app');
  });

  it('the global row applies when nothing above sets a role, and Automatic is the floor', () => {
    expect(resolveExecutionPlacePreference('auto', undefined, { settings: {} }, 'workspace-server')).toBe(
      'workspace-server',
    );
    expect(resolveExecutionPlacePreference('auto', undefined, { settings: {} }, 'auto')).toBe('auto');
  });
});
