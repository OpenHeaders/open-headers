/**
 * Data plane — the three-tool snapshot fetch and the rule-detail
 * fetch, through the injected caller (transport-free).
 */

import { describe, expect, it } from 'vitest';
import { fetchDashboardSnapshot, fetchRuleDetail } from '../../../src/tui/data';
import { makeToolCaller } from './fixtures';

describe('data', () => {
  it('fetchDashboardSnapshot calls the three read tools with defaults', async () => {
    const fixture = makeToolCaller();
    const snapshot = await fetchDashboardSnapshot(fixture.call);
    expect(fixture.calls.map((entry) => entry.tool).sort()).toEqual([
      'environments_list',
      'rules_list',
      'workspaces_list',
    ]);
    for (const entry of fixture.calls) expect(entry.args).toEqual({});
    expect(snapshot.workspaces.activeWorkspaceId).toBe('ws-team');
    expect(snapshot.rules.rules).toHaveLength(3);
  });

  it('fetchRuleDetail returns the parsed rule plus pretty definition lines', async () => {
    const fixture = makeToolCaller();
    const detail = await fetchRuleDetail(fixture.call, 'rule-auth');
    expect(fixture.calls[0]).toEqual({ tool: 'rules_get', args: { uid: 'rule-auth' } });
    expect(detail.workspaceId).toBe('ws-team');
    expect(detail.rule.uid).toBe('rule-auth');
    expect(detail.definitionLines[0]).toBe('{');
    expect(detail.definitionLines.some((line) => line.includes('"uid": "rule-auth"'))).toBe(true);
  });

  it('propagates the caller error untouched', async () => {
    const fixture = makeToolCaller();
    await expect(fetchRuleDetail(fixture.call, 'missing')).rejects.toThrow("no rule with uid 'missing'");
  });
});
