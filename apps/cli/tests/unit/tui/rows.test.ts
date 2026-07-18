/**
 * Pane row models — projection from the snapshot payloads, the
 * synthetic "No environment" row, filtering, and stable identities.
 */

import { describe, expect, it } from 'vitest';
import { buildPaneRows, filterRows } from '../../../src/tui/rows';
import { makeEnvironmentsPayload, makeSnapshot } from './fixtures';

describe('rows', () => {
  it('projects the three panes and appends the No environment row', () => {
    const rows = buildPaneRows(makeSnapshot(), 'No environment');
    expect(rows.workspaces.map((ws) => ws.name)).toEqual(['team-a', 'personal']);
    expect(rows.rules).toHaveLength(3);
    const last = rows.environments[rows.environments.length - 1];
    expect(last.none).toBe(true);
    expect(last.name).toBe('No environment');
    expect(last.active).toBe(false);
  });

  it('the No environment row is active when no environment is selected', () => {
    const snapshot = makeSnapshot({ environments: makeEnvironmentsPayload({ activeEnvironmentId: null }) });
    const rows = buildPaneRows(snapshot, 'No environment');
    expect(rows.environments[rows.environments.length - 1].active).toBe(true);
    expect(rows.environments[0].active).toBe(false);
  });

  it('a null snapshot yields empty panes', () => {
    const rows = buildPaneRows(null, 'No environment');
    expect(rows.workspaces).toEqual([]);
    expect(rows.environments).toEqual([]);
    expect(rows.rules).toEqual([]);
  });

  it('filterRows is a case-insensitive name substring match', () => {
    const rows = buildPaneRows(makeSnapshot(), 'No environment').rules;
    expect(filterRows(rows, 'AUTH').map((row) => row.name)).toEqual(['auth-header-inject']);
    expect(filterRows(rows, '')).toHaveLength(3);
    expect(filterRows(rows, 'zzz')).toEqual([]);
  });

  it('rows carry stable identities (uid / id / the synthetic sentinel)', () => {
    const rows = buildPaneRows(makeSnapshot(), 'No environment');
    expect(rows.rules[0].identity).toBe('rule-auth');
    expect(rows.workspaces[0].identity).toBe('ws-team');
    const identities = rows.environments.map((env) => env.identity);
    expect(new Set(identities).size).toBe(identities.length);
  });
});
