/**
 * The engine's running services (the activity monitor plan §6, law 4):
 * every fact is read from its owner at the moment of the ask — nothing
 * is kept between two asks, and a handle that is not there answers
 * `unreadable`, never off.
 */

import type { WorkspaceTreeBindingRecord } from '@openheaders/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DaemonBindState } from '../../../src/daemon/bind-supervisor';
import type { LiveScheduleSummary } from '../../../src/daemon/live/live-refresh-scheduler';
import { listRunningServices, type RunningServicesDeps } from '../../../src/daemon/running-services';
import type { PeerSummary } from '../../../src/host-runtime/ws-server';

function makePeer(overrides: Partial<PeerSummary> = {}): PeerSummary {
  return {
    peerId: 'peer-1',
    role: 'extension',
    agent: '@openheaders/extension@2026.11.0',
    browser: 'chrome',
    workspaceId: 'ws-1',
    nodeId: 'node-1',
    installId: null,
    tokenId: 'token-1',
    userId: 'user-1',
    isLoopback: true,
    ...overrides,
  };
}

function makeBinding(workspaceId: string): WorkspaceTreeBindingRecord {
  return { workspaceId, rootDir: `/Users/john/work/${workspaceId}` };
}

describe('listRunningServices', () => {
  let bindState: DaemonBindState | null;
  let peers: PeerSummary[];
  let schedule: LiveScheduleSummary | null;
  let bindings: WorkspaceTreeBindingRecord[];
  let open: number;
  let mcpEnabled: boolean;
  let proxyPort: number | null;
  let deps: RunningServicesDeps;

  beforeEach(() => {
    bindState = { kind: 'bound', host: '127.0.0.1', port: 8137 };
    peers = [];
    schedule = { scheduled: 0, nextFireAt: null };
    bindings = [];
    open = 0;
    mcpEnabled = false;
    proxyPort = null;
    deps = {
      getBindState: () => bindState,
      getWsServer: () => ({ listConnectedPeers: () => peers }),
      getLiveSchedule: () => schedule,
      getWorkspaceTree: () => ({ list: () => bindings, openCount: () => open }),
      isMcpEnabled: () => mcpEnabled,
      getProxyCapturePort: () => proxyPort,
    };
  });

  it('lists the five services in the order the panel shows them', () => {
    expect(listRunningServices(deps).map((row) => row.kind)).toEqual([
      'sync-server',
      'workflows',
      'git',
      'mcp-server',
      'proxy-capture',
    ]);
  });

  it('a peer that connects shows in the next ask, and one that leaves is gone from the one after', () => {
    expect(listRunningServices(deps)[0]).toEqual({
      kind: 'sync-server',
      state: 'on',
      host: '127.0.0.1',
      port: 8137,
      peers: [],
    });

    peers = [makePeer(), makePeer({ peerId: 'peer-2', role: 'cli', browser: undefined })];
    expect(listRunningServices(deps)[0]).toMatchObject({
      peers: [
        { role: 'extension', browser: 'chrome' },
        { role: 'cli', browser: null },
      ],
    });

    peers = [];
    expect(listRunningServices(deps)[0]).toMatchObject({ state: 'on', peers: [] });
  });

  it('a server that is not listening is off at the address it was asked for, with no peer', () => {
    peers = [makePeer()];
    bindState = { kind: 'failed', host: '0.0.0.0', port: 8137, error: new Error('EADDRINUSE') };
    expect(listRunningServices(deps)[0]).toEqual({
      kind: 'sync-server',
      state: 'off',
      host: '0.0.0.0',
      port: 8137,
      peers: [],
    });
    bindState = { kind: 'binding', host: '127.0.0.1', port: 8137 };
    expect(listRunningServices(deps)[0]).toMatchObject({ state: 'off', peers: [] });
  });

  it('a server that never reported a bind is unreadable, not off', () => {
    bindState = null;
    expect(listRunningServices(deps)[0]).toEqual({
      kind: 'sync-server',
      state: 'unreadable',
      host: null,
      port: null,
      peers: [],
    });
  });

  it('workflows: scheduled and not, and a runner that is not started is unreadable', () => {
    expect(listRunningServices(deps)[1]).toEqual({ kind: 'workflows', state: 'off', scheduled: 0, nextFireAt: null });
    schedule = { scheduled: 4, nextFireAt: 1_763_640_000_000 };
    expect(listRunningServices(deps)[1]).toEqual({
      kind: 'workflows',
      state: 'on',
      scheduled: 4,
      nextFireAt: 1_763_640_000_000,
    });
    schedule = null;
    expect(listRunningServices(deps)[1]).toEqual({
      kind: 'workflows',
      state: 'unreadable',
      scheduled: 0,
      nextFireAt: null,
    });
  });

  it('git: bound and not, a folder that did not open is bound and not watched, a runtime gone is unreadable', () => {
    expect(listRunningServices(deps)[2]).toEqual({ kind: 'git', state: 'off', bound: 0, watching: 0 });
    bindings = [makeBinding('ws-1'), makeBinding('ws-2')];
    open = 1;
    expect(listRunningServices(deps)[2]).toEqual({ kind: 'git', state: 'on', bound: 2, watching: 1 });
    deps.getWorkspaceTree = () => null;
    expect(listRunningServices(deps)[2]).toEqual({ kind: 'git', state: 'unreadable', bound: 0, watching: 0 });
  });

  it('the MCP server follows its switch between two asks', () => {
    expect(listRunningServices(deps)[3]).toEqual({ kind: 'mcp-server', state: 'off' });
    mcpEnabled = true;
    expect(listRunningServices(deps)[3]).toEqual({ kind: 'mcp-server', state: 'on' });
  });

  it('proxy capture is on at the port it listens on, and off with none', () => {
    expect(listRunningServices(deps)[4]).toEqual({ kind: 'proxy-capture', state: 'off', port: null });
    proxyPort = 8138;
    expect(listRunningServices(deps)[4]).toEqual({ kind: 'proxy-capture', state: 'on', port: 8138 });
  });
});
