/**
 * Phase C F5 — grouping helper used by the Activity Feed panel.
 *
 * Pure transform: list-of-entries → list-of-groups. The classifier can
 * emit multiple kinds per `mutationId`, so the panel renders one card
 * per mutation with chips per kind in a deterministic order.
 */

import { describe, expect, it } from 'vitest';

import type { ActivityEntry } from '@openheaders/core/sync';
import {
  groupActivityEntriesByMutation,
  type ActivityFeedGroup,
} from '@openheaders/ui/workbench/components/panels/activity-feed-group';

const WS = '0193a8ff-c000-7000-8000-000000000001';

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: overrides.id ?? '',
    workspaceId: WS,
    orgId: 'org-test',
    mutationId: 'm1',
    hlc: { physicalMs: 1_000, logical: 0, nodeId: 'peer' },
    kind: 'edit-entity',
    entityType: 'rule',
    entityId: 'r1',
    origin: { surfaceId: 'peer', deviceId: 'peer' },
    observedAt: 1_700_000_000_000,
    read: false,
    ...overrides,
  };
}

describe('groupActivityEntriesByMutation', () => {
  it('returns an empty list for empty input', () => {
    expect(groupActivityEntriesByMutation([])).toEqual([]);
  });

  it('groups multi-kind entries under one mutationId', () => {
    const rows: ActivityEntry[] = [
      entry({ mutationId: 'm-a', kind: 'edit-entity' }),
      entry({ mutationId: 'm-a', kind: 'sensitive-field-rotation' }),
    ];
    const groups = groupActivityEntriesByMutation(rows);
    expect(groups.length).toBe(1);
    expect(groups[0].kinds).toEqual(['edit-entity', 'sensitive-field-rotation']);
    expect(groups[0].entries.length).toBe(2);
  });

  it('preserves caller-supplied order across groups', () => {
    const rows: ActivityEntry[] = [
      entry({ mutationId: 'm-newer', kind: 'create-entity' }),
      entry({ mutationId: 'm-older', kind: 'delete-entity' }),
    ];
    const groups: ActivityFeedGroup[] = groupActivityEntriesByMutation(rows);
    expect(groups.map((g) => g.mutationId)).toEqual(['m-newer', 'm-older']);
  });

  it('sorts kinds inside a group deterministically irrespective of input order', () => {
    const rows: ActivityEntry[] = [
      entry({ mutationId: 'm', kind: 'permission-scope-expansion' }),
      entry({ mutationId: 'm', kind: 'edit-entity' }),
    ];
    const groups = groupActivityEntriesByMutation(rows);
    expect(groups[0].kinds).toEqual(['edit-entity', 'permission-scope-expansion']);
  });

  it('marks group read iff every entry in it is read', () => {
    const allRead = groupActivityEntriesByMutation([
      entry({ mutationId: 'm', kind: 'edit-entity', read: true }),
      entry({ mutationId: 'm', kind: 'sensitive-field-rotation', read: true }),
    ]);
    expect(allRead[0].read).toBe(true);

    const mixed = groupActivityEntriesByMutation([
      entry({ mutationId: 'm', kind: 'edit-entity', read: true }),
      entry({ mutationId: 'm', kind: 'sensitive-field-rotation', read: false }),
    ]);
    expect(mixed[0].read).toBe(false);
  });

  it('dedupes the kinds list when duplicate kinds appear', () => {
    const groups = groupActivityEntriesByMutation([
      entry({ mutationId: 'm', kind: 'edit-entity', id: 'a' }),
      entry({ mutationId: 'm', kind: 'edit-entity', id: 'b' }),
    ]);
    expect(groups[0].kinds).toEqual(['edit-entity']);
    expect(groups[0].entries.length).toBe(2);
  });
});
