/**
 * The workspace-tree runtime's count of open bindings — the fact the
 * activity monitor's Git row reads (the activity monitor plan §6, law
 * 4): a bound folder that is open is watched; unbound, it is neither
 * listed nor counted.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { openRuntimeHarness, type RuntimeHarness } from './_runtime-harness';

let harness: RuntimeHarness | null = null;

afterEach(async () => {
  await harness?.dispose();
  harness = null;
});

describe('the workspace-tree runtime: how many bindings are open', () => {
  it('counts a bound folder while it is open, and none once it is unbound', { timeout: 30_000 }, async () => {
    harness = await openRuntimeHarness();
    expect(harness.runtime.list()).toHaveLength(1);
    expect(harness.runtime.openCount()).toBe(1);

    await harness.runtime.unbind(harness.workspaceId);
    expect(harness.runtime.list()).toHaveLength(0);
    expect(harness.runtime.openCount()).toBe(0);
  });
});
