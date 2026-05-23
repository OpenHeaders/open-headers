/**
 * Phase C M1 — mode-switch decision gating.
 *
 * Pins the host-neutral pieces (`summarizeWorkspaces`,
 * `isPresenceEmpty`, `decideModeSwitch`). Host wiring — change-listener
 * on `backend.mode`, peer-presence RPC, dialog UI — lands in M2/M3.
 */

import {
  type DataPresenceSummary,
  decideModeSwitch,
  isPresenceEmpty,
  summarizeWorkspaces,
  type WorkspaceContentSnapshot,
} from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import { collectLocalDataPresence, type DataPresenceOracle, USER_CONTENT_ENTITY_TYPES } from '@openheaders/oracle/sync';
import { describe, expect, it } from 'vitest';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';
const WS_B = '0193a8ff-c000-7000-8000-00000000000b';

function workspace(overrides: Partial<WorkspaceContentSnapshot> = {}): WorkspaceContentSnapshot {
  return {
    workspaceId: WS_A,
    workspaceName: 'Workspace',
    entityCounts: {},
    ...overrides,
  };
}

function emptyPresence(): DataPresenceSummary {
  return summarizeWorkspaces([workspace()]);
}

function populatedPresence(): DataPresenceSummary {
  return summarizeWorkspaces([workspace({ entityCounts: { rule: 12, environment: 3, template: 5 } })]);
}

describe('summarizeWorkspaces', () => {
  it('rolls up zero workspaces to an empty summary', () => {
    const summary = summarizeWorkspaces([]);
    expect(summary).toEqual({
      workspaceCount: 0,
      hasUserContent: false,
      totalEntityCount: 0,
      workspaces: [],
    });
  });

  it('rolls up a single empty workspace to no user content', () => {
    const summary = summarizeWorkspaces([workspace()]);
    expect(summary.workspaceCount).toBe(1);
    expect(summary.hasUserContent).toBe(false);
    expect(summary.totalEntityCount).toBe(0);
  });

  it('sums entity counts across types and workspaces', () => {
    const summary = summarizeWorkspaces([
      workspace({ workspaceId: WS_A, entityCounts: { rule: 12, environment: 3 } }),
      workspace({ workspaceId: WS_B, entityCounts: { rule: 4, template: 5 } }),
    ]);
    expect(summary.workspaceCount).toBe(2);
    expect(summary.totalEntityCount).toBe(24);
    expect(summary.hasUserContent).toBe(true);
  });

  it('treats any non-zero entity count as user content', () => {
    const summary = summarizeWorkspaces([workspace({ entityCounts: { rule: 1 } })]);
    expect(summary.hasUserContent).toBe(true);
  });

  it('does not mutate the caller`s workspace array', () => {
    const list: WorkspaceContentSnapshot[] = [workspace()];
    const summary = summarizeWorkspaces(list);
    list.push(workspace({ workspaceId: WS_B }));
    expect(summary.workspaces).toHaveLength(1);
  });
});

describe('isPresenceEmpty', () => {
  it('is empty for zero workspaces', () => {
    expect(isPresenceEmpty(summarizeWorkspaces([]))).toBe(true);
  });

  it('is empty for a single default workspace with no content', () => {
    expect(isPresenceEmpty(emptyPresence())).toBe(true);
  });

  it('is not empty when the lone workspace has content', () => {
    expect(isPresenceEmpty(populatedPresence())).toBe(false);
  });

  it('is not empty when multiple workspaces exist even with no content', () => {
    const summary = summarizeWorkspaces([
      workspace({ workspaceId: WS_A }),
      workspace({ workspaceId: WS_B, workspaceName: 'Other' }),
    ]);
    expect(isPresenceEmpty(summary)).toBe(false);
  });
});

describe('decideModeSwitch', () => {
  it('reports no-change when the mode identifier is unchanged', () => {
    const verdict = decideModeSwitch({
      fromMode: 'in-browser',
      toMode: 'in-browser',
      source: emptyPresence(),
      target: emptyPresence(),
    });
    expect(verdict).toEqual({ kind: 'no-change' });
  });

  it('reports peer-unreachable when the target is null AND source has data to lose', () => {
    const verdict = decideModeSwitch({
      fromMode: 'in-browser',
      toMode: 'desktop-app',
      source: populatedPresence(),
      target: null,
    });
    expect(verdict).toEqual({ kind: 'peer-unreachable' });
  });

  it('commits when target is null but source has nothing to lose (first-time switch into a peer)', () => {
    // The chicken-and-egg case: a fresh extension can't reach the
    // desktop-app peer until backend.mode flips, so blocking on
    // unreachability would trap the user. Source is empty → no data
    // can be silently abandoned; let the mode flip and let the WS
    // handshake bring in the peer's state.
    const verdict = decideModeSwitch({
      fromMode: 'in-browser',
      toMode: 'desktop-app',
      source: emptyPresence(),
      target: null,
    });
    expect(verdict).toEqual({ kind: 'both-empty' });
  });

  it('short-circuits to both-empty when neither side has data', () => {
    const verdict = decideModeSwitch({
      fromMode: 'in-browser',
      toMode: 'desktop-app',
      source: emptyPresence(),
      target: emptyPresence(),
    });
    expect(verdict).toEqual({ kind: 'both-empty' });
  });

  it('short-circuits to silent-use-target when source is empty', () => {
    const verdict = decideModeSwitch({
      fromMode: 'in-browser',
      toMode: 'desktop-app',
      source: emptyPresence(),
      target: populatedPresence(),
    });
    expect(verdict).toEqual({ kind: 'silent-use-target' });
  });

  it('short-circuits to silent-import-source when target is empty', () => {
    const verdict = decideModeSwitch({
      fromMode: 'in-browser',
      toMode: 'desktop-app',
      source: populatedPresence(),
      target: emptyPresence(),
    });
    expect(verdict).toEqual({ kind: 'silent-import-source' });
  });

  it('routes to show-dialog when both sides have data, preserving both summaries', () => {
    const source = populatedPresence();
    const target = summarizeWorkspaces([workspace({ workspaceId: WS_B, entityCounts: { rule: 8, environment: 1 } })]);
    const verdict = decideModeSwitch({
      fromMode: 'in-browser',
      toMode: 'desktop-app',
      source,
      target,
    });
    expect(verdict.kind).toBe('show-dialog');
    if (verdict.kind !== 'show-dialog') throw new Error('expected show-dialog');
    expect(verdict.source).toBe(source);
    expect(verdict.target).toBe(target);
    // U5.5: targetOrg defaults to null when no probe Org is supplied.
    expect(verdict.targetOrg).toBeNull();
  });

  it('forwards the probe targetOrg onto the show-dialog verdict (U5.5)', () => {
    const targetOrg: Org = { id: WS_B, name: 'Desktop home', hostKind: 'desktop', isPrivate: true };
    const verdict = decideModeSwitch({
      fromMode: 'in-browser',
      toMode: 'desktop-app',
      source: populatedPresence(),
      target: summarizeWorkspaces([workspace({ workspaceId: WS_B, entityCounts: { rule: 1 } })]),
      targetOrg,
    });
    if (verdict.kind !== 'show-dialog') throw new Error('expected show-dialog');
    expect(verdict.targetOrg).toEqual(targetOrg);
  });

  it('treats a single empty workspace on the source as empty even if the user is switching away from it', () => {
    const verdict = decideModeSwitch({
      fromMode: 'desktop-app',
      toMode: 'local-self-hosted',
      source: emptyPresence(),
      target: populatedPresence(),
    });
    expect(verdict.kind).toBe('silent-use-target');
  });
});

describe('collectLocalDataPresence', () => {
  function makeOracle(entities: ReadonlyArray<{ type: string }>): DataPresenceOracle {
    return { materializeAll: () => entities };
  }

  it('returns an empty snapshot list when no workspaces are resident', () => {
    const snaps = collectLocalDataPresence({
      workspaces: [],
      getOracle: () => null,
    });
    expect(snaps).toEqual([]);
  });

  it('emits a zero-count snapshot for a workspace whose oracle is null', () => {
    const snaps = collectLocalDataPresence({
      workspaces: [{ id: WS_A, name: 'Workspace' }],
      getOracle: () => null,
    });
    expect(snaps).toEqual([{ workspaceId: WS_A, workspaceName: 'Workspace', entityCounts: {} }]);
  });

  it('counts user-content entity types and groups by type', () => {
    const oracle = makeOracle([
      { type: 'rule' },
      { type: 'rule' },
      { type: 'environment' },
      { type: 'template' },
      { type: 'template' },
      { type: 'template' },
    ]);
    const snaps = collectLocalDataPresence({
      workspaces: [{ id: WS_A, name: 'Workspace' }],
      getOracle: () => oracle,
    });
    expect(snaps[0].entityCounts).toEqual({ rule: 2, environment: 1, template: 3 });
  });

  it('excludes singletons (workspace-variables, vault, layout-state, pause-markers, files)', () => {
    const oracle = makeOracle([
      { type: 'workspace-variables' },
      { type: 'vault' },
      { type: 'layout-state' },
      { type: 'pause-markers' },
      { type: 'files' },
      { type: 'rule' },
    ]);
    const snaps = collectLocalDataPresence({
      workspaces: [{ id: WS_A, name: 'Workspace' }],
      getOracle: () => oracle,
    });
    expect(snaps[0].entityCounts).toEqual({ rule: 1 });
  });

  it('preserves workspace input order in the snapshot list', () => {
    const oracle = makeOracle([{ type: 'rule' }]);
    const snaps = collectLocalDataPresence({
      workspaces: [
        { id: WS_B, name: 'Beta' },
        { id: WS_A, name: 'Alpha' },
      ],
      getOracle: () => oracle,
    });
    expect(snaps.map((s) => s.workspaceId)).toEqual([WS_B, WS_A]);
  });

  it('routes each workspace through its own oracle accessor', () => {
    const calls: string[] = [];
    const snaps = collectLocalDataPresence({
      workspaces: [
        { id: WS_A, name: 'Alpha' },
        { id: WS_B, name: 'Beta' },
      ],
      getOracle: (id) => {
        calls.push(id);
        return makeOracle(id === WS_A ? [{ type: 'rule' }] : [{ type: 'rule' }, { type: 'rule' }]);
      },
    });
    expect(calls).toEqual([WS_A, WS_B]);
    expect(snaps[0].entityCounts).toEqual({ rule: 1 });
    expect(snaps[1].entityCounts).toEqual({ rule: 2 });
  });

  it('exports a stable USER_CONTENT_ENTITY_TYPES set covering the core user-facing types', () => {
    // Tripwire — if a new user-facing entity type lands, intentionally
    // update this allowlist so the mode-switch gate counts it.
    expect(USER_CONTENT_ENTITY_TYPES.has('rule')).toBe(true);
    expect(USER_CONTENT_ENTITY_TYPES.has('environment')).toBe(true);
    expect(USER_CONTENT_ENTITY_TYPES.has('template')).toBe(true);
    expect(USER_CONTENT_ENTITY_TYPES.has('request')).toBe(true);
    expect(USER_CONTENT_ENTITY_TYPES.has('live-variable')).toBe(true);
    expect(USER_CONTENT_ENTITY_TYPES.has('workspace-variables')).toBe(false);
    expect(USER_CONTENT_ENTITY_TYPES.has('vault')).toBe(false);
  });
});
