/**
 * MCP server install — engine-opaque wiring only. Builds the tool
 * registry (read + observe + write + execute + secrets tiers; tier gating
 * is per call in the engine), injects the Node host's execution
 * capabilities (Node transport + chain runner) and the agent-traffic
 * tap, reads the MCP settings from `OH.settingsUser`
 * (same dotted-key record the daemon bind supervisor reads), and hands
 * back the HTTP handler the daemon bind composes onto its socket.
 *
 * Settings, all default-off / read-only-by-default:
 *
 *   - `mcp.enabled`      — master switch. Off ⇒ the `/mcp` path 404s.
 *   - `mcp.allowObserve` — enables `observe`-tier tools (agent traffic).
 *   - `mcp.allowWrite`   — enables `write`-tier tools (Phase 2).
 *   - `mcp.allowExecute` — enables `execute`-tier tools (Phase 3).
 *   - `mcp.allowSecrets` — enables `secrets`-tier tools (Phase 5).
 *
 * The handler reads the mirrored settings per request, so a toggle
 * flip applies immediately — no rebind, no app restart.
 */

import type { IncomingMessage } from 'node:http';
import { hostStorage, OH } from '@openheaders/core/storage';
import { createNodeRequestTransport } from '../live/node-request-transport';
import {
  createDiffToolDefinitions,
  createExecuteToolDefinitions,
  createImportToolDefinitions,
  createMcpHttpHandler,
  createMcpToolRegistry,
  createReadToolDefinitions,
  createRunToolDefinitions,
  createRuntimeToolDefinitions,
  createSecretToolDefinitions,
  createSessionToolDefinitions,
  createTrafficToolDefinitions,
  createWriteToolDefinitions,
  type McpHttpHandler,
  type McpObserveCallEvent,
  type McpPolicy,
  type McpToolTier,
} from '../mcp';
import type { TrafficSessionQuery, TrafficTap } from '../traffic';
import { runWorkflowRefresh } from './live/chain-runner';
import { runRequestSuite } from './live/suite-runner';

export interface McpServerInstall {
  readonly handler: McpHttpHandler;
  dispose(): void;
}

function policyFromSettings(values: Record<string, unknown> | undefined): { enabled: boolean; policy: McpPolicy } {
  const enabled = values?.['mcp.enabled'] === true;
  const tiers = new Set<McpToolTier>(['read']);
  if (values?.['mcp.allowObserve'] === true) tiers.add('observe');
  if (values?.['mcp.allowWrite'] === true) tiers.add('write');
  if (values?.['mcp.allowExecute'] === true) tiers.add('execute');
  if (values?.['mcp.allowSecrets'] === true) tiers.add('secrets');
  return { enabled, policy: { enabledTiers: tiers } };
}

export interface InstallMcpServerOptions {
  /** Reported in the MCP `initialize` result — the host app's version. */
  serverVersion: string;
  /** Trusted-proxy-aware peer resolver for rejection log lines (Phase 3). */
  resolvePeer?: (req: IncomingMessage) => string;
  /** Observe-visibility sink (the agent-traffic plan §4) — the spine
   *  lands each successful `observe`-tier call in the Activity Feed. */
  onObserveCall?: (event: McpObserveCallEvent) => void;
  /** The agent-traffic tap (PLAN §5) — injected by the boot spine; the
   *  observe-tier `traffic_*` tools register only when present. */
  trafficTap?: TrafficTap;
  /** The sessions-archive read plane (PLAN §11.5, C7) — the observe-tier
   *  session tools register only when present. Redaction and the raw
   *  grant live below it; tools are pure projection consumers. */
  trafficSessions?: TrafficSessionQuery;
}

export async function installMcpServer(options: InstallMcpServerOptions): Promise<McpServerInstall> {
  let current = policyFromSettings((await hostStorage.get(OH.settingsUser)) ?? {});

  const unsubscribe = hostStorage.subscribe(OH.settingsUser, (next) => {
    current = policyFromSettings(next);
  });

  const handler = createMcpHttpHandler({
    registry: createMcpToolRegistry([
      ...createReadToolDefinitions(),
      ...(options.trafficTap !== undefined
        ? createTrafficToolDefinitions({
            tap: options.trafficTap,
            // traffic_to_rule's dual-switch guard: write-tier by gate,
            // but it reads observed traffic — live-read like the policy.
            isObserveEnabled: () => current.policy.enabledTiers.has('observe'),
          })
        : []),
      ...(options.trafficSessions !== undefined
        ? createSessionToolDefinitions({ sessions: options.trafficSessions })
        : []),
      ...createDiffToolDefinitions(),
      ...createWriteToolDefinitions(),
      ...createImportToolDefinitions(),
      ...createRuntimeToolDefinitions(),
      ...createSecretToolDefinitions(),
      ...createExecuteToolDefinitions({
        transport: createNodeRequestTransport(),
        runWorkflow: runWorkflowRefresh,
      }),
      ...createRunToolDefinitions({
        runSuite: runRequestSuite,
        runWorkflow: runWorkflowRefresh,
      }),
    ]),
    isEnabled: () => current.enabled,
    getPolicy: () => current.policy,
    serverVersion: options.serverVersion,
    resolvePeer: options.resolvePeer,
    ...(options.onObserveCall !== undefined ? { onObserveCall: options.onObserveCall } : {}),
  });

  return {
    handler,
    dispose() {
      unsubscribe();
    },
  };
}
