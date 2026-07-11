/**
 * Human formatters — compact lines over the read-tool payload
 * projections, with the diagram's summary registers ("3 enabled · 1
 * disabled · workspace …") and masked-secret discipline.
 */

import { describe, expect, it } from 'vitest';
import {
  formatActivity,
  formatEnvironmentSwitch,
  formatEnvironments,
  formatRequestSend,
  formatRequests,
  formatRules,
  formatRuleToggle,
  formatVariableSet,
  formatVariables,
  formatWorkflowRun,
  formatWorkflowRuns,
  formatWorkflows,
  formatWorkspaceDiff,
  formatWorkspaceSwitch,
  formatWorkspaces,
} from '../../src/format';

describe('formatWorkspaces', () => {
  it('marks the active workspace and unloaded ones', () => {
    const lines = formatWorkspaces({
      activeWorkspaceId: 'ws-1',
      workspaces: [
        { id: 'ws-1', name: 'Acme', kind: 'personal', active: true, loaded: true },
        { id: 'ws-2', name: 'Team', kind: 'org', active: false, loaded: false },
      ],
    });
    expect(lines[0]).toBe('* ws-1  Acme (personal)');
    expect(lines[1]).toBe('  ws-2  Team (org)  — not loaded');
    expect(lines[2]).toBe('2 workspace(s) · active: ws-1');
  });
});

describe('formatRules', () => {
  it('renders enabled state, draft flag, and the summary register', () => {
    const lines = formatRules({
      workspaceId: 'ws-1',
      rules: [
        { uid: 'r-1', name: 'auth header', type: 'header', enabled: true, published: true },
        { uid: 'r-2', name: 'block tracker', type: 'block', enabled: true, published: false },
        { uid: 'r-3', name: 'redirect api', type: 'redirect', enabled: false, published: true },
      ],
    });
    expect(lines[0]).toBe('on   r-1  auth header  [header]');
    expect(lines[1]).toBe('on   r-2  block tracker  [block]  (draft)');
    expect(lines[2]).toBe('off  r-3  redirect api  [redirect]');
    expect(lines[3]).toBe('2 enabled · 1 disabled · workspace ws-1');
  });
});

describe('formatEnvironments', () => {
  it('stars the active environment', () => {
    const lines = formatEnvironments({
      workspaceId: 'ws-1',
      activeEnvironmentId: 'e-2',
      defaultEnvironmentId: null,
      environments: [
        { uid: 'e-1', name: 'dev', variables: [] },
        { uid: 'e-2', name: 'staging', variables: [{}, {}] },
      ],
    });
    expect(lines[0]).toBe('  e-1  dev  (0 vars)');
    expect(lines[1]).toBe('* e-2  staging  (2 vars)');
    expect(lines[2]).toBe('2 environment(s) · workspace ws-1');
  });
});

describe('formatVariables', () => {
  it('lists every scope, masks secrets, and never shows vault values', () => {
    const lines = formatVariables({
      workspaceId: 'ws-1',
      vault: [{ name: 'apiKey', kind: 'static' }],
      environments: [
        {
          name: 'prod',
          variables: [
            { name: 'host', value: 'api.openheaders.io', masked: false },
            { name: 'secret', masked: true },
          ],
        },
      ],
      collections: [
        { name: 'checkout', scope: 'requests', variables: [{ name: 'base', value: '/v2', masked: false }] },
      ],
      workspace: [{ name: 'region', value: 'eu', masked: false }],
      live: [{ reference: '{{live.token}}', workflowUid: 'wf-1' }],
    });
    expect(lines).toEqual([
      'vault (1):',
      '  apiKey (static)',
      'environment "prod" (2):',
      '  host = api.openheaders.io',
      '  secret (masked)',
      'collection "checkout" [requests] (1):',
      '  base = /v2',
      'workspace (1):',
      '  region = eu',
      'live (1):',
      '  {{live.token}} ← workflow wf-1',
    ]);
  });
});

describe('formatRequests', () => {
  it('renders method-aligned rows', () => {
    const lines = formatRequests({
      workspaceId: 'ws-1',
      requests: [{ uid: 'q-1', name: 'login', method: 'POST', url: 'https://api.openheaders.io/login' }],
    });
    expect(lines[0]).toBe('q-1  POST    https://api.openheaders.io/login  login');
    expect(lines[1]).toBe('1 request(s) · workspace ws-1');
  });
});

describe('formatWorkflows', () => {
  it('renders state, steps, draft, and live variables', () => {
    const lines = formatWorkflows({
      workspaceId: 'ws-1',
      workflows: [
        { uid: 'wf-1', name: 'auth', enabled: true, published: false, stepCount: 2, liveVariables: ['token'] },
        { uid: 'wf-2', name: 'noop', enabled: false, published: true, stepCount: 1, liveVariables: [] },
      ],
    });
    expect(lines[0]).toBe('on   wf-1  auth  2 step(s)  (draft)  → token');
    expect(lines[1]).toBe('off  wf-2  noop  1 step(s)');
    expect(lines[2]).toBe('2 workflow(s) · workspace ws-1');
  });
});

describe('formatWorkflowRuns', () => {
  it('renders health, failures, and the last error', () => {
    const lines = formatWorkflowRuns({
      workspaceId: 'ws-1',
      runs: [
        {
          workflowUid: 'wf-1',
          extractedAt: 1767225600000,
          consecutiveFailures: 2,
          lastErrorMessage: 'step 2 timed out',
          refreshHealth: 'degraded',
        },
      ],
    });
    expect(lines[0]).toBe('wf-1  degraded  fail×2  extracted 2026-01-01T00:00:00.000Z  err: step 2 timed out');
    expect(lines[1]).toBe('1 run record(s) · workspace ws-1');
  });
});

describe('formatRuleToggle', () => {
  it('is agent-honest for a published rule — extensions apply it, not the desktop', () => {
    const lines = formatRuleToggle({ workspaceId: 'ws-1', uid: 'r-1', enabled: true, published: true });
    expect(lines).toEqual(['rule r-1 → on — live on connected browser extensions · workspace ws-1']);
  });

  it('flags a draft as having no live effect', () => {
    const lines = formatRuleToggle({ workspaceId: 'ws-1', uid: 'r-2', enabled: false, published: false });
    expect(lines).toEqual(['rule r-2 → off  (draft — no effect on live traffic) · workspace ws-1']);
  });
});

describe('formatEnvironmentSwitch', () => {
  it('names the new active environment', () => {
    const lines = formatEnvironmentSwitch({
      workspaceId: 'ws-1',
      activeEnvironmentId: 'e-2',
      environment: { uid: 'e-2', name: 'staging' },
    });
    expect(lines).toEqual(['active environment: staging (e-2) · workspace ws-1']);
  });

  it('renders the "No environment" pick', () => {
    const lines = formatEnvironmentSwitch({ workspaceId: 'ws-1', activeEnvironmentId: null, environment: null });
    expect(lines).toEqual(['active environment: none · workspace ws-1']);
  });
});

describe('formatVariableSet', () => {
  it('renders a workspace-scope add', () => {
    const lines = formatVariableSet({
      workspaceId: 'ws-1',
      scope: 'workspace',
      variable: { name: 'region', type: 'default', updated: false },
    });
    expect(lines).toEqual(['added region in workspace scope · workspace ws-1']);
  });

  it('renders a collection-scope secret update', () => {
    const lines = formatVariableSet({
      workspaceId: 'ws-1',
      scope: 'collection:requests',
      collection: { uid: 'c-1', name: 'checkout' },
      variable: { name: 'apiKey', type: 'secret', updated: true },
    });
    expect(lines).toEqual(['updated apiKey (secret) in collection "checkout" [collection:requests] · workspace ws-1']);
  });
});

describe('formatWorkspaceSwitch', () => {
  it('names the new active workspace and where it came from', () => {
    const lines = formatWorkspaceSwitch({
      activeWorkspaceId: 'ws-2',
      previousWorkspaceId: 'ws-1',
      workspace: { id: 'ws-2', name: 'Team', kind: 'org', active: true, loaded: true },
    });
    expect(lines).toEqual(['active workspace: Team (ws-2) · was ws-1']);
  });

  it('flags a switch that has not finished loading', () => {
    const lines = formatWorkspaceSwitch({
      activeWorkspaceId: 'ws-2',
      previousWorkspaceId: 'ws-2',
      workspace: { id: 'ws-2', name: 'Team', kind: 'org', active: true, loaded: false },
    });
    expect(lines).toEqual(['active workspace: Team (ws-2)  — still loading']);
  });
});

describe('formatRequestSend', () => {
  it('renders the status/size/timing line', () => {
    const lines = formatRequestSend({
      workspaceId: 'ws-1',
      request: { uid: 'q-1', name: 'login', method: 'POST', url: 'https://api.openheaders.io/login' },
      environmentId: 'e-1',
      sent: true,
      response: {
        status: 200,
        statusText: 'OK',
        url: 'https://api.openheaders.io/login',
        bodyBytes: 532,
        durationMs: 145.4,
        bodyTruncated: false,
      },
    });
    expect(lines).toEqual(['POST https://api.openheaders.io/login → 200 OK · 532 B · 145 ms · workspace ws-1']);
  });

  it('humanizes sizes and flags truncation', () => {
    const lines = formatRequestSend({
      workspaceId: 'ws-1',
      request: { uid: 'q-1', name: 'dump', method: 'GET', url: 'https://api.openheaders.io/dump' },
      environmentId: null,
      sent: true,
      response: {
        status: 200,
        statusText: 'OK',
        url: 'https://api.openheaders.io/dump',
        bodyBytes: 2 * 1024 * 1024,
        durationMs: 1200,
        bodyTruncated: true,
      },
    });
    expect(lines).toEqual([
      'GET https://api.openheaders.io/dump → 200 OK · 2.0 MB · 1200 ms' +
        '  (body truncated — use --json for the capped body) · workspace ws-1',
    ]);
  });
});

describe('formatWorkflowRun', () => {
  it('renders captures count, live variables by name only, and skips', () => {
    const lines = formatWorkflowRun({
      workspaceId: 'ws-1',
      workflowUid: 'wf-1',
      ok: true,
      skippedStepIds: ['s-3'],
      extractedAt: 1767225600000,
      stepCaptures: { 's-1': { token: 'oh_secret_value', ttl: '3600' }, 's-2': { userId: 'u-1' } },
      liveVariables: [
        { name: 'token', reference: '{{live.token}}', published: true },
        { name: 'ttl', reference: '{{live.ttl}}', published: false },
      ],
    });
    expect(lines).toEqual([
      'workflow wf-1 ran ok · 3 capture(s) · extracted 2026-01-01T00:00:00.000Z · skipped: s-3',
      '  {{live.token}} (published)',
      '  {{live.ttl}} (draft)',
      'workspace ws-1',
    ]);
    expect(lines.join('\n')).not.toContain('oh_secret_value');
  });
});

describe('formatWorkspaceDiff', () => {
  it('rolls up only the families with differences', () => {
    const lines = formatWorkspaceDiff({
      workspaceId: 'ws-1',
      otherWorkspaceId: 'ws-2',
      diff: {
        rules: {
          added: [{ id: 'r-9', name: 'new rule' }],
          removed: [],
          changed: [{ id: 'r-1', name: 'auth header' }],
        },
        requests: { added: [], removed: [], changed: [] },
      },
    });
    expect(lines).toEqual([
      'rules: +1 −0 ~1',
      '  + new rule (r-9)',
      '  ~ auth header (r-1)',
      '2 difference(s) · ws-1 vs ws-2',
    ]);
  });

  it('says so when there are no differences', () => {
    const lines = formatWorkspaceDiff({
      workspaceId: 'ws-1',
      otherWorkspaceId: 'ws-2',
      diff: { rules: { added: [], removed: [], changed: [] } },
    });
    expect(lines).toEqual(['no differences', '0 difference(s) · ws-1 vs ws-2']);
  });
});

describe('formatActivity', () => {
  it('prefers the classifier summary and falls back to kind + entity', () => {
    const lines = formatActivity({
      workspaceId: 'ws-1',
      entries: [
        {
          observedAt: 1767225600000,
          kind: 'updated',
          entityType: 'rule',
          entityId: 'r-1',
          summary: 'Rule "auth" enabled',
        },
        { observedAt: 1767225601000, kind: 'created', entityType: 'request', entityId: 'q-1' },
      ],
    });
    expect(lines[0]).toBe('2026-01-01T00:00:00.000Z  Rule "auth" enabled');
    expect(lines[1]).toBe('2026-01-01T00:00:01.000Z  created request q-1');
    expect(lines[2]).toBe('2 entries · workspace ws-1');
  });
});
