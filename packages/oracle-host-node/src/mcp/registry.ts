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
 * `read` ships enabled with the server; `observe` / `write` / `execute`
 * / `secrets` are separate opt-ins. A token's effective rights are the
 * intersection of its own tier grant and the host's enabled tiers.
 *
 * `observe` (the agent-traffic plan §4) gates live-traffic observation —
 * deliberately NOT `read`: a token holding `read` gets nothing from the
 * traffic surface, and the default capability is `workspace.observe`,
 * distinct from `workspace.read`.
 */
export type McpToolTier = 'read' | 'observe' | 'write' | 'execute' | 'secrets';

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
  /** The user the token acts as (directory binding; unbound → the
   *  daemon operator). Resolved once per request at the auth gate. */
  readonly userId: string;
  /**
   * Per-call progress seat, present only when the calling request
   * carried the MCP progress opt-in (`_meta.progressToken`). Emits a
   * spec `notifications/progress` frame; fire-and-forget — emission
   * failure never fails the tool call. Tools that never stream simply
   * ignore it.
   */
  readonly progress?: (update: { progress: number; total?: number; message?: string }) => void;
  /**
   * Raw-projection flag for the observe-visibility seam
   * (the agent-traffic plan §11.5): a tool whose read projected RAW
   * values under the persistent unredacted grant calls this so the
   * call's Activity Feed entry carries the raw flag. The projection
   * layer decides raw vs redacted — this only reports what happened.
   */
  readonly markRawRead?: () => void;
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
   * Resolve the workspaceId(s) the gate authorizes against — every
   * workspace the handler will touch, including the active-workspace
   * default the handler itself falls back to (a gate that resolves
   * narrower than the handler is a bypass). Return an array when the
   * tool reads more than one workspace (all must pass), `null` for
   * workspace-less capabilities, `undefined` when no workspace context
   * is resolvable (gate skips; the handler must then fail without
   * touching workspace state).
   */
  readonly resolveWorkspaceId: (args: Record<string, unknown>) => string | readonly string[] | null | undefined;
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
