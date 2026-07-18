/**
 * Data plane — the three-tool snapshot fetch, the rule-detail fetch,
 * and the Phase 4 write wrappers, through the injected caller
 * (transport-free).
 */

import { describe, expect, it } from 'vitest';
import {
  fetchDashboardSnapshot,
  fetchRuleDetail,
  publishRule,
  switchEnvironment,
  switchWorkspace,
  toggleRule,
} from '../../../src/tui/data';
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

  it('toggleRule sends the explicit target state and returns the ack state', async () => {
    const fixture = makeToolCaller();
    const ack = await toggleRule(fixture.call, 'rule-auth', false);
    expect(fixture.calls[0]).toEqual({ tool: 'rules_toggle', args: { uid: 'rule-auth', enabled: false } });
    expect(ack).toEqual({ uid: 'rule-auth', enabled: false, published: true });
  });

  it('publishRule patches published through rules_update and reads the ack rule', async () => {
    const fixture = makeToolCaller();
    const ack = await publishRule(fixture.call, 'rule-probe', true);
    expect(fixture.calls[0]).toEqual({
      tool: 'rules_update',
      args: { uid: 'rule-probe', updates: { published: true } },
    });
    expect(ack).toEqual({ uid: 'rule-probe', enabled: true, published: true });
  });

  it('switchEnvironment carries null for No environment and returns the active uid', async () => {
    const fixture = makeToolCaller();
    expect(await switchEnvironment(fixture.call, 'env-prod')).toEqual({ environmentId: 'env-prod' });
    expect(await switchEnvironment(fixture.call, null)).toEqual({ environmentId: null });
    expect(fixture.calls.map((entry) => entry.args)).toEqual([{ environmentId: 'env-prod' }, { environmentId: null }]);
  });

  it('switchWorkspace returns the ack workspace id', async () => {
    const fixture = makeToolCaller();
    expect(await switchWorkspace(fixture.call, 'ws-personal')).toEqual({ workspaceId: 'ws-personal' });
    expect(fixture.calls[0]).toEqual({ tool: 'workspaces_switch', args: { workspaceId: 'ws-personal' } });
  });
});
