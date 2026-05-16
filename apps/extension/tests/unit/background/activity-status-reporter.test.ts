/**
 * Activity Feed → Status subsystem bridge — pure mapper + install
 * lifecycle.
 *
 * Pins describeActivityStatus across the empty + populated cases and
 * verifies installActivityStatusReporter wires entry / workspace-switch
 * subscriptions so the Status pill receives:
 *
 *   - an initial green baseline emit (synchronous);
 *   - a follow-up emit after the async countUnread resolves;
 *   - a yellow pulse on every classified entry for the active
 *     workspace, ignoring entries for other workspaces;
 *   - a re-baseline when the active workspace flips.
 */

import type { ActivityEntry } from '@openheaders/core/sync';
import { describe, expect, it, vi } from 'vitest';

import {
  describeActivityStatus,
  installActivityStatusReporter,
  type ActivityStatusEntry,
} from '@/background/activity-status-reporter';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';
const WS_B = '0193a8ff-c000-7000-8000-00000000000b';

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  const base: ActivityEntry = {
    id: 'id-1',
    workspaceId: WS_A,
    mutationId: 'm1',
    hlc: { physicalMs: 1_000, logical: 0, nodeId: 'sw' },
    kind: 'edit-entity',
    entityType: 'rule',
    entityId: 'r1',
    origin: { surfaceId: 'popup', deviceId: 'device-peer' },
    observedAt: 42,
    read: false,
  };
  return { ...base, ...overrides };
}

describe('describeActivityStatus', () => {
  it('reports green when unread is zero', () => {
    const out = describeActivityStatus({ unreadCount: 0, lastEntry: null, activeWorkspaceId: WS_A });
    expect(out.state).toBe('green');
    expect(out.message).toMatch(/up to date/i);
    expect(out.context).toMatchObject({ unread: 0, workspaceId: WS_A });
  });

  it('reports yellow with the count + last-entry headline', () => {
    const entry = makeEntry({ kind: 'create-entity', entityType: 'rule' });
    const out = describeActivityStatus({ unreadCount: 3, lastEntry: entry, activeWorkspaceId: WS_A });
    expect(out.state).toBe('yellow');
    expect(out.message).toMatch(/3 new/);
    expect(out.message).toMatch(/new rule/i);
    expect(out.context).toMatchObject({ unread: 3, lastKind: 'create-entity', lastEntityType: 'rule' });
  });

  it('falls back to a generic message when no last entry is known', () => {
    const out = describeActivityStatus({ unreadCount: 2, lastEntry: null, activeWorkspaceId: WS_A });
    expect(out.state).toBe('yellow');
    expect(out.message).toMatch(/2 new activity/i);
  });

  it('uses kind-specific copy for highlight kinds', () => {
    for (const [kind, pattern] of [
      ['supersede-local-edit', /overrode local/i],
      ['sensitive-field-rotation', /sensitive field/i],
      ['permission-scope-expansion', /scope widened/i],
      ['delete-entity', /deleted/i],
    ] as const) {
      const entry = makeEntry({ kind });
      const out = describeActivityStatus({ unreadCount: 1, lastEntry: entry, activeWorkspaceId: WS_A });
      expect(out.message).toMatch(pattern);
    }
  });
});

describe('installActivityStatusReporter', () => {
  function makeDeps(opts: { activeId: string | null; unread: number }) {
    const entryListeners = new Set<(entry: ActivityEntry) => void>();
    const switchListeners = new Set<() => void>();
    let activeId = opts.activeId;
    const report = vi.fn<(entry: ActivityStatusEntry) => void>();
    const countUnread = vi.fn(async (_wsId: string) => opts.unread);
    return {
      report,
      countUnread,
      entryListeners,
      switchListeners,
      setActiveId: (next: string | null) => {
        activeId = next;
      },
      fireEntry: (entry: ActivityEntry) => {
        for (const l of entryListeners) l(entry);
      },
      fireSwitch: () => {
        for (const l of switchListeners) l();
      },
      deps: {
        report,
        subscribeActivityEntries: (l: (entry: ActivityEntry) => void) => {
          entryListeners.add(l);
          return () => entryListeners.delete(l);
        },
        countUnread,
        getActiveWorkspaceId: () => activeId,
        subscribeActiveWorkspace: (l: () => void) => {
          switchListeners.add(l);
          return () => switchListeners.delete(l);
        },
      },
    };
  }

  it('emits a green baseline synchronously, then a refreshed baseline after countUnread resolves', async () => {
    const { deps, report, countUnread } = makeDeps({ activeId: WS_A, unread: 4 });
    installActivityStatusReporter(deps);

    // First emit is the green-zero baseline (synchronous, pre-countUnread).
    expect(report.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(report.mock.calls[0][0].state).toBe('green');

    // countUnread resolves on the microtask queue.
    await Promise.resolve();
    await Promise.resolve();

    expect(countUnread).toHaveBeenCalledWith(WS_A);
    const latest = report.mock.calls.at(-1);
    expect(latest?.[0].state).toBe('yellow');
    expect(latest?.[0].message).toMatch(/4 new/);
  });

  it('bumps the unread counter on every entry for the active workspace', async () => {
    const { deps, report, fireEntry } = makeDeps({ activeId: WS_A, unread: 0 });
    installActivityStatusReporter(deps);
    await Promise.resolve();
    await Promise.resolve();

    report.mockClear();
    fireEntry(makeEntry({ workspaceId: WS_A, kind: 'create-entity' }));
    fireEntry(makeEntry({ workspaceId: WS_A, kind: 'edit-entity', mutationId: 'm2' }));

    const last = report.mock.calls.at(-1);
    expect(last?.[0].state).toBe('yellow');
    expect(last?.[0].message).toMatch(/2 new/);
    expect(last?.[0].context).toMatchObject({ unread: 2 });
  });

  it('ignores entries for non-active workspaces', async () => {
    const { deps, report, fireEntry } = makeDeps({ activeId: WS_A, unread: 0 });
    installActivityStatusReporter(deps);
    await Promise.resolve();
    await Promise.resolve();

    report.mockClear();
    fireEntry(makeEntry({ workspaceId: WS_B, kind: 'create-entity' }));

    expect(report).not.toHaveBeenCalled();
  });

  it('re-baselines on active-workspace switch', async () => {
    const deps = makeDeps({ activeId: WS_A, unread: 0 });
    installActivityStatusReporter(deps.deps);
    await Promise.resolve();
    await Promise.resolve();

    deps.report.mockClear();
    deps.countUnread.mockResolvedValueOnce(7);

    deps.setActiveId(WS_B);
    deps.fireSwitch();
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.countUnread).toHaveBeenLastCalledWith(WS_B);
    const last = deps.report.mock.calls.at(-1);
    expect(last?.[0].state).toBe('yellow');
    expect(last?.[0].message).toMatch(/7 new/);
    expect(last?.[0].context).toMatchObject({ workspaceId: WS_B });
  });

  it('treats null active workspace as zero unread', async () => {
    const { deps, report, countUnread } = makeDeps({ activeId: null, unread: 0 });
    installActivityStatusReporter(deps);
    await Promise.resolve();
    await Promise.resolve();

    expect(countUnread).not.toHaveBeenCalled();
    const last = report.mock.calls.at(-1);
    expect(last?.[0].state).toBe('green');
    expect(last?.[0].context).toMatchObject({ workspaceId: null });
  });

  it('dispose tears down subscriptions', async () => {
    const { deps, report, entryListeners, switchListeners, fireEntry } = makeDeps({ activeId: WS_A, unread: 0 });
    const handle = installActivityStatusReporter(deps);
    await Promise.resolve();

    handle.dispose();
    expect(entryListeners.size).toBe(0);
    expect(switchListeners.size).toBe(0);

    report.mockClear();
    fireEntry(makeEntry({ workspaceId: WS_A }));
    expect(report).not.toHaveBeenCalled();
  });
});
