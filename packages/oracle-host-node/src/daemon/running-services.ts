/**
 * What the engine keeps running, as facts (the activity monitor plan
 * §6, law 4): one read-only composition over the handles the spine
 * already holds — the bind lifecycle and the peer registry, the live
 * runner's timers, the workspace-tree runtime's bindings, the MCP
 * switch, the capture proxy. Nothing is kept between two asks, so the
 * answer can never drift from the registries it reads; a handle that
 * is not there answers `unreadable`, never off.
 */

import type { ActivityMonitorServiceRow } from '@openheaders/core/activity-monitor';
import type { OracleWsServer } from '../host-runtime/ws-server';
import type { WorkspaceTreeRuntime } from '../workspace-tree';
import type { DaemonBindState } from './bind-supervisor';
import type { LiveScheduleSummary } from './live/live-refresh-scheduler';

export interface RunningServicesDeps {
  /** Last bind lifecycle event — null before the supervisor's first emit. */
  getBindState(): DaemonBindState | null;
  /** Live server slot — null before the first bind and mid-rebind. */
  getWsServer(): Pick<OracleWsServer, 'listConnectedPeers'> | null;
  /** The live runner's armed refreshes — null while the runner is not started. */
  getLiveSchedule(): LiveScheduleSummary | null;
  /** The workspace-tree runtime — null once disposed. */
  getWorkspaceTree(): Pick<WorkspaceTreeRuntime, 'list' | 'openCount'> | null;
  isMcpEnabled(): boolean;
  /** The capture proxy's listening port — null while it is stopped. */
  getProxyCapturePort(): number | null;
}

export function listRunningServices(deps: RunningServicesDeps): ActivityMonitorServiceRow[] {
  const bind = deps.getBindState();
  const bound = bind?.kind === 'bound';
  const peers = bound ? (deps.getWsServer()?.listConnectedPeers() ?? []) : [];
  const schedule = deps.getLiveSchedule();
  const tree = deps.getWorkspaceTree();
  const boundWorkspaces = tree?.list().length ?? 0;
  const proxyPort = deps.getProxyCapturePort();

  return [
    {
      kind: 'sync-server',
      state: bind === null ? 'unreadable' : bound ? 'on' : 'off',
      host: bind?.host ?? null,
      port: bind?.port ?? null,
      peers: peers.map((peer) => ({ role: peer.role, browser: peer.browser ?? null })),
    },
    {
      kind: 'workflows',
      state: schedule === null ? 'unreadable' : schedule.scheduled > 0 ? 'on' : 'off',
      scheduled: schedule?.scheduled ?? 0,
      nextFireAt: schedule?.nextFireAt ?? null,
    },
    {
      kind: 'git',
      state: tree === null ? 'unreadable' : boundWorkspaces > 0 ? 'on' : 'off',
      bound: boundWorkspaces,
      watching: tree?.openCount() ?? 0,
    },
    { kind: 'mcp-server', state: deps.isMcpEnabled() ? 'on' : 'off' },
    { kind: 'proxy-capture', state: proxyPort === null ? 'off' : 'on', port: proxyPort },
  ];
}
