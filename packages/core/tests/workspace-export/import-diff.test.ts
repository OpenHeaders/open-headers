/**
 * Coverage for `diffIncomingAgainstPriorImport` — the pure transform
 * driving the soft-dedup banner's "show changes since last import"
 * affordance (status doc L229).
 */

import { describe, expect, it } from 'vitest';
import type { HeaderRule, Request } from '../../src/types/index';
import { diffIncomingAgainstPriorImport, type WorkspaceExport } from '../../src/workspace-export/index';

const ENVELOPE_BASE = {
  schemaVersion: 5 as const,
  kind: 'workspace-export' as const,
  exportFormatVersion: 1,
  exportId: 'e8a1b2c3',
  exportedAt: '2026-04-27T18:30:00.000Z',
  source: {
    app: 'extension' as const,
    appVersion: '5.0.4',
    platform: 'chrome' as const,
    workspaceLabel: 'WS',
  },
  scope: 'workspace' as const,
  workspace: { uid: 'wuid0001', name: 'WS' },
  meta: {
    redactions: { vault: 'omitted' as const, liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
    counts: {
      rules: 0,
      requests: 0,
      environments: 0,
      liveWorkflows: 0,
      liveVariables: 0,
      templates: 0,
      secrets: 0,
      specs: 0,
    },
  },
};

function makeRule(uid: string, name: string): HeaderRule {
  return {
    schemaVersion: 5,
    version: 1,
    uid,
    path: `rules/c1/${name}-${uid}`,
    name,
    type: 'header',
    enabled: false,
    conditions: [{ uid: 'cnd00001', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
    action: { requestHeaders: [], responseHeaders: [] },
  } as HeaderRule;
}

function makeRequest(uid: string, name: string): Request {
  return {
    schemaVersion: 5,
    version: 1,
    uid,
    path: `requests/c1/${name}-${uid}`,
    name,
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [],
  } as unknown as Request;
}

function envelope(rules: HeaderRule[], requests: Request[] = []): WorkspaceExport {
  return {
    ...ENVELOPE_BASE,
    entities: {
      collections: [],
      folders: [],
      rules,
      requests,
      templates: [],
      environments: [],
      workspaceVars: { schemaVersion: 5, variables: [] },
      liveWorkflows: [],
      liveVariables: [],
      specs: [],
    },
  } as WorkspaceExport;
}

describe('diffIncomingAgainstPriorImport', () => {
  it('flags new uids, kept uids, and removed uids per entity type', () => {
    const incoming = envelope([makeRule('rul00001', 'Auth'), makeRule('rul00002', 'Trace')]);
    const priorStrategies = {
      'rules:rul00001': 'update',
      'rules:rul99999': 'create',
    };

    const diff = diffIncomingAgainstPriorImport(incoming, priorStrategies);
    const rules = diff.sections.find((s) => s.type === 'rules');

    expect(rules?.prior).toBe(2);
    expect(rules?.incoming).toBe(2);
    expect(rules?.newUids.map((x) => x.uid)).toEqual(['rul00002']);
    expect(rules?.removedUids).toEqual(['rul99999']);
    expect(rules?.keptUids).toEqual(['rul00001']);
  });

  it('totals add up across every entity type', () => {
    const incoming = envelope([makeRule('rul00001', 'A'), makeRule('rul00002', 'B')], [makeRequest('req00001', 'X')]);
    const priorStrategies = { 'rules:rul00001': 'update', 'requests:req99999': 'create' };

    const diff = diffIncomingAgainstPriorImport(incoming, priorStrategies);

    expect(diff.totals.prior).toBe(2);
    expect(diff.totals.incoming).toBe(3);
    expect(diff.totals.new).toBe(2); // rul00002 + req00001
    expect(diff.totals.removed).toBe(1); // requests:req99999
    expect(diff.totals.kept).toBe(1); // rul00001
  });

  it('handles an empty prior import (every incoming uid is new)', () => {
    const incoming = envelope([makeRule('rul00001', 'A')]);
    const diff = diffIncomingAgainstPriorImport(incoming, {});

    expect(diff.totals.prior).toBe(0);
    expect(diff.totals.new).toBe(1);
    expect(diff.totals.removed).toBe(0);
    expect(diff.sections.find((s) => s.type === 'rules')?.newUids).toEqual([{ uid: 'rul00001', name: 'A' }]);
  });

  it('ignores malformed strategy keys (no colon)', () => {
    const incoming = envelope([makeRule('rul00001', 'A')]);
    const diff = diffIncomingAgainstPriorImport(incoming, {
      'malformed-no-colon': 'update',
      'rules:rul00001': 'update',
    });
    expect(diff.totals.kept).toBe(1);
    expect(diff.totals.removed).toBe(0);
  });
});
