/**
 * MCP tool registry — the single record type every Open Headers MCP
 * tool is defined through. The registry derives everything downstream
 * from these records: `tools/list` payloads, the per-call policy gate,
 * and the audit emit. Tools never hand-roll transport or policy.
 *
 * Mirrors the `GateRule` discipline in oracle's `sync-rpc.ts`: each
 * tool declares how to resolve the workspaceId it acts on (`null` =
 * workspace-less capability, `undefined` = no workspace resolvable;
 * the gate skips and the handler degrades on its own).
 */

import type { Capability } from '@openheaders/core/identity';

/**
 * Policy tier a tool belongs to. Tiers gate tool families wholesale:
 * `read` ships enabled with the server; `write` / `execute` / `secrets`
 * are separate opt-ins (Phase 2+). A token's effective rights are the
 * intersection of its own tier grant and the host's enabled tiers.
 */
export type McpToolTier = 'read' | 'write' | 'execute' | 'secrets';

/**
 * `MutatorContext.surfaceId` every MCP-minted envelope carries. Hosts
 * key agent-surface behavior off it — notably the Activity Feed, which
 * classifies MCP mutations like peer-sourced ones (a local UI emit is
 * the user's own gesture; an agent's is worth surfacing + reverting).
 */
export const MCP_SURFACE_ID = 'mcp';

/** Identity of the daemon token that authenticated the calling client. */
export interface McpToolCallContext {
  readonly tokenId: string;
  readonly tokenLabel?: string;
}

export interface McpToolDefinition {
  /** MCP tool name — `domain_verb` (the MCP name charset disallows `.`). */
  readonly name: string;
  /** Human-readable display name (MCP `title` annotation). */
  readonly title: string;
  /** Agent-facing description — written for an LLM choosing among tools. */
  readonly description: string;
  /** JSON Schema for the tool's arguments. */
  readonly inputSchema: Record<string, unknown>;
  readonly tier: McpToolTier;
  /**
   * Capability consulted by the gate. Defaults per tier (`read` /
   * `secrets` → `workspace.read`, `write` / `execute` →
   * `workspace.write`); tools acting on host-level state override
   * (e.g. `workspaces_list` → `workspace.list`).
   */
  readonly capability?: Capability;
  /**
   * Resolve the workspaceId the gate authorizes against. Return `null`
   * for workspace-less capabilities, `undefined` when no workspace
   * context is resolvable (gate skips; handler degrades with intent).
   */
  readonly resolveWorkspaceId: (args: Record<string, unknown>) => string | null | undefined;
  /**
   * Execute the tool. Throw {@link McpToolInputError} for caller
   * mistakes (bad uid, unknown workspace) — the server surfaces those
   * as in-band tool errors the agent can read and correct.
   */
  readonly handler: (args: Record<string, unknown>, ctx: McpToolCallContext) => Promise<unknown>;
}

/**
 * Caller-correctable failure (unknown uid, malformed argument, no
 * active workspace). Surfaced to the MCP client as an `isError` tool
 * result — visible to the agent — rather than a protocol error.
 */
export class McpToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpToolInputError';
  }
}

export interface McpToolRegistry {
  list(): readonly McpToolDefinition[];
  get(name: string): McpToolDefinition | undefined;
}

export function createMcpToolRegistry(tools: readonly McpToolDefinition[]): McpToolRegistry {
  const byName = new Map<string, McpToolDefinition>();
  for (const tool of tools) {
    if (byName.has(tool.name)) {
      throw new Error(`duplicate MCP tool name: ${tool.name}`);
    }
    byName.set(tool.name, tool);
  }
  return {
    list: () => [...byName.values()],
    get: (name) => byName.get(name),
  };
}
