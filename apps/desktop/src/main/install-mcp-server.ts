/**
 * Desktop MCP server install — engine-opaque wiring only. Builds the
 * tool registry (read + write + execute + secrets tiers; tier gating is per call
 * in the engine), injects the desktop's execution capabilities (Node
 * transport + chain runner), reads the MCP settings from `OH.settingsUser`
 * (same dotted-key record the daemon bind supervisor reads), and hands
 * back the HTTP handler the daemon bind composes onto its socket.
 *
 * Settings, all default-off / read-only-by-default:
 *
 *   - `mcp.enabled`      — master switch. Off ⇒ the `/mcp` path 404s.
 *   - `mcp.allowWrite`   — enables `write`-tier tools (Phase 2).
 *   - `mcp.allowExecute` — enables `execute`-tier tools (Phase 3).
 *   - `mcp.allowSecrets` — enables `secrets`-tier tools (Phase 5).
 *
 * The handler reads the mirrored settings per request, so a toggle
 * flip applies immediately — no rebind, no app restart.
 */

import { hostStorage, OH } from '@openheaders/core/storage';
import { createNodeRequestTransport } from '@openheaders/oracle-host-node/live/node-request-transport';
import {
  createDiffToolDefinitions,
  createExecuteToolDefinitions,
  createImportToolDefinitions,
  createMcpHttpHandler,
  createMcpToolRegistry,
  createReadToolDefinitions,
  createRuntimeToolDefinitions,
  createSecretToolDefinitions,
  createWriteToolDefinitions,
  type McpHttpHandler,
  type McpPolicy,
  type McpToolTier,
} from '@openheaders/oracle-host-node/mcp';
import { app } from 'electron';
import { runDesktopWorkflowRefresh } from './live/chain-runner';

export interface McpServerInstall {
  readonly handler: McpHttpHandler;
  dispose(): void;
}

function policyFromSettings(values: Record<string, unknown> | undefined): { enabled: boolean; policy: McpPolicy } {
  const enabled = values?.['mcp.enabled'] === true;
  const tiers = new Set<McpToolTier>(['read']);
  if (values?.['mcp.allowWrite'] === true) tiers.add('write');
  if (values?.['mcp.allowExecute'] === true) tiers.add('execute');
  if (values?.['mcp.allowSecrets'] === true) tiers.add('secrets');
  return { enabled, policy: { enabledTiers: tiers } };
}

export async function installMcpServer(): Promise<McpServerInstall> {
  let current = policyFromSettings((await hostStorage.get(OH.settingsUser)) ?? {});

  const unsubscribe = hostStorage.subscribe(OH.settingsUser, (next) => {
    current = policyFromSettings(next);
  });

  const handler = createMcpHttpHandler({
    registry: createMcpToolRegistry([
      ...createReadToolDefinitions(),
      ...createDiffToolDefinitions(),
      ...createWriteToolDefinitions(),
      ...createImportToolDefinitions(),
      ...createRuntimeToolDefinitions(),
      ...createSecretToolDefinitions(),
      ...createExecuteToolDefinitions({
        transport: createNodeRequestTransport(),
        runWorkflow: runDesktopWorkflowRefresh,
      }),
    ]),
    isEnabled: () => current.enabled,
    getPolicy: () => current.policy,
    serverVersion: app.getVersion(),
  });

  return {
    handler,
    dispose() {
      unsubscribe();
    },
  };
}
