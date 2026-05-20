/**
 * Phase C W3 — mode-switch verdict matrix integration.
 *
 * Drives `requestModeSwitchVerdict` (which composes `decideModeSwitch`
 * over local + peer presence) through `applyModeSwitchVerdict` end-to-end
 * across the (id-match, data-match) quadrants that DATA_PLANE_TOPOLOGIES
 * §11.2 calls out as the mode-switch gate's truth table:
 *
 *   - both empty       ⇒ both-empty            ⇒ commitMode
 *   - both populated   ⇒ show-dialog
 *   - source empty     ⇒ silent-use-target
 *   - target empty     ⇒ silent-import-source
 *   - peer unreachable ⇒ peer-unreachable
 *
 * Per-layer behavior is pinned in mode-switch.test.ts (decide),
 * mode-switch-orchestrator.test.ts (request-verdict) and
 * mode-switch-apply-verdict.test.ts (dispatcher). This file pins that
 * the layers compose: a local bridge response + peer summary flows
 * end-to-end into the right dispatcher branch with the right verdict shape.
 */

import type { DataPresenceSummary, ModeSwitchVerdict, WorkspaceContentSnapshot } from '@openheaders/core/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: vi.fn(() => () => undefined),
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

import {
  applyModeSwitchVerdict,
  type ModeSwitchVerdictHandlers,
  requestModeSwitchVerdict,
} from '@openheaders/ui/shared/mode-switch';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';
const WS_B = '0193a8ff-c000-7000-8000-00000000000b';

function workspace(id: string, name: string, entityCounts: Record<string, number> = {}): WorkspaceContentSnapshot {
  return { workspaceId: id, workspaceName: name, entityCounts };
}

function presence(workspaces: WorkspaceContentSnapshot[]): DataPresenceSummary {
  const total = workspaces.reduce((a, w) => a + Object.values(w.entityCounts).reduce((s, n) => s + n, 0), 0);
  return {
    workspaceCount: workspaces.length,
    hasUserContent: total > 0,
    totalEntityCount: total,
    workspaces,
  };
}

function makeHandlers(): ModeSwitchVerdictHandlers & {
  __commit: ReturnType<typeof vi.fn>;
  __warn: ReturnType<typeof vi.fn>;
  __open: ReturnType<typeof vi.fn>;
} {
  const __commit = vi.fn();
  const __warn = vi.fn();
  const __open = vi.fn();
  return {
    commitMode: __commit,
    warnPeerUnreachable: __warn,
    openDialog: __open,
    __commit,
    __warn,
    __open,
  };
}

async function drive(
  localWorkspaces: WorkspaceContentSnapshot[],
  peer: DataPresenceSummary | null,
): Promise<{
  verdict: ModeSwitchVerdict;
  handlers: ReturnType<typeof makeHandlers>;
}> {
  mockCall.mockResolvedValueOnce({ workspaces: localWorkspaces });
  const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
    queryPeerPresence: async () => (peer === null ? null : { presence: peer, org: null }),
  });
  const handlers = makeHandlers();
  applyModeSwitchVerdict(verdict, handlers);
  return { verdict, handlers };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('mode-switch verdict matrix — data-presence quadrants', () => {
  describe('both empty', () => {
    it('commits silently — both-empty short-circuits before any dialog', async () => {
      const { verdict, handlers } = await drive(
        [workspace(WS_A, 'Workspace')],
        presence([workspace(WS_A, 'Workspace')]),
      );
      expect(verdict).toEqual({ kind: 'both-empty' });
      expect(handlers.__commit).toHaveBeenCalledTimes(1);
      expect(handlers.__warn).not.toHaveBeenCalled();
      expect(handlers.__open).not.toHaveBeenCalled();
    });

    it('treats zero-workspace local + single-empty peer as both-empty', async () => {
      const { verdict, handlers } = await drive([], presence([workspace(WS_A, 'Workspace')]));
      expect(verdict.kind).toBe('both-empty');
      expect(handlers.__commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('both populated', () => {
    it('routes to show-dialog carrying both presence summaries intact', async () => {
      const { verdict, handlers } = await drive(
        [workspace(WS_A, 'Production', { rule: 12 })],
        presence([workspace(WS_B, 'production', { rule: 4 })]),
      );
      if (verdict.kind !== 'show-dialog') throw new Error('expected show-dialog');
      expect(verdict.source.totalEntityCount).toBe(12);
      expect(verdict.target.totalEntityCount).toBe(4);
      expect(handlers.__open).toHaveBeenCalledTimes(1);
      // openDialog receives the SAME verdict reference — no copy or re-shape between layers.
      expect(handlers.__open.mock.calls[0][0]).toBe(verdict);
      expect(handlers.__commit).not.toHaveBeenCalled();
    });
  });

  describe('asymmetric data-presence shortcuts skip the dialog regardless of ids', () => {
    it('routes to silent-import-source when target is empty even if the lone source/target ids match', async () => {
      const { verdict, handlers } = await drive(
        [workspace(WS_A, 'Production', { rule: 5 })],
        presence([workspace(WS_A, 'Production')]),
      );
      expect(verdict).toEqual({ kind: 'silent-import-source' });
      expect(handlers.__commit).toHaveBeenCalledTimes(1);
      expect(handlers.__open).not.toHaveBeenCalled();
    });

    it('routes to silent-use-target when source is empty even if the lone source/target ids differ', async () => {
      const { verdict, handlers } = await drive(
        [workspace(WS_A, 'Production')],
        presence([workspace(WS_B, 'Production', { rule: 5 })]),
      );
      expect(verdict).toEqual({ kind: 'silent-use-target' });
      expect(handlers.__commit).toHaveBeenCalledTimes(1);
      expect(handlers.__open).not.toHaveBeenCalled();
    });

    it('routes to peer-unreachable when peer query yields null, regardless of source data', async () => {
      const { verdict, handlers } = await drive([workspace(WS_A, 'Production', { rule: 5 })], null);
      expect(verdict).toEqual({ kind: 'peer-unreachable' });
      expect(handlers.__warn).toHaveBeenCalledTimes(1);
      expect(handlers.__commit).not.toHaveBeenCalled();
      expect(handlers.__open).not.toHaveBeenCalled();
    });
  });
});
