/**
 * MCP server assembly — wires a tool registry + policy onto the SDK's
 * low-level `Server` (tools-only capability; no resources / prompts /
 * sampling in v1).
 *
 * One `Server` instance is built per HTTP request (stateless streamable
 * HTTP — see `http-handler.ts`), so construction stays cheap: handlers
 * close over the registry and the caller's token context, nothing else.
 *
 * Error contract:
 *   - {@link McpToolInputError} / {@link McpPermissionDeniedError} →
 *     in-band `isError` tool results. These are agent-correctable
 *     (fix the uid, pick another workspace, ask the user to enable a
 *     tier) so they must be visible to the model, not swallowed as
 *     transport failures.
 *   - Unknown tool name → JSON-RPC error (client-programming fault).
 *   - Anything else → rethrown; the SDK wraps it as an internal error
 *     and the host log keeps the stack.
 */

import { Server } from '@modelcontextprotocol/sdk/server';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { hostLogger as logger } from '@openheaders/core/logger';
import { gateMcpToolCall, McpPermissionDeniedError, type McpPolicy } from './policy';
import { type McpToolCallContext, McpToolInputError, type McpToolRegistry } from './registry';

const SCOPE = 'McpServer';

export const MCP_SERVER_NAME = 'open-headers';

/**
 * One successful `observe`-tier tool call (AGENT_TRAFFIC_PLAN.md §4).
 * Reads through the observe tier must be visible after the fact —
 * "what did the agent look at?" — so the server reports each one to
 * the host's sink, which lands it in the Activity Feed the way
 * MCP mutations already land via `MCP_SURFACE_ID`. Emitted only on
 * success: denied or failed calls are already recorded by the policy
 * gate's audit emit, and an entry for traffic the agent never received
 * would be a false answer to that question.
 */
export interface McpObserveCallEvent {
  readonly toolName: string;
  /** Workspaces the gate authorized the read against (may be empty for
   *  a tool the gate skipped — the sink decides where those land). */
  readonly workspaceIds: readonly string[];
  readonly tokenId: string;
  readonly tokenLabel?: string;
  readonly userId: string;
  /** The call projected RAW values under the persistent unredacted
   *  grant (§11.5) — the tool reported it via `ctx.markRawRead`. */
  readonly raw?: boolean;
}

export interface CreateMcpServerOptions {
  readonly registry: McpToolRegistry;
  readonly getPolicy: () => McpPolicy;
  /** Host app version, announced in the MCP `initialize` response. */
  readonly serverVersion: string;
  /** Token identity of the authenticated client this server serves. */
  readonly context: McpToolCallContext;
  /** Observe-visibility sink — fire-and-forget; a throwing sink never
   *  fails the tool call. Structural: every `observe`-tier tool is
   *  reported here, so an S3 tool cannot be born invisible. */
  readonly onObserveCall?: (event: McpObserveCallEvent) => void;
}

function textResult(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function createMcpServer(options: CreateMcpServerOptions): Server {
  const { registry, getPolicy, serverVersion, context, onObserveCall } = options;

  const server = new Server({ name: MCP_SERVER_NAME, version: serverVersion }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, () => {
    const policy = getPolicy();
    return {
      tools: registry
        .list()
        .filter((tool) => policy.enabledTiers.has(tool.tier))
        .map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const tool = registry.get(request.params.name);
    if (!tool) {
      throw new McpError(ErrorCode.InvalidParams, `unknown tool: ${request.params.name}`);
    }
    const args: Record<string, unknown> = request.params.arguments ?? {};
    // The spec's progress opt-in: a `_meta.progressToken` on the call
    // opens the per-call progress seat. `sendNotification` ties the
    // frame to this request id, so on an SSE answer it rides the same
    // POST stream ahead of the final result; fire-and-forget by
    // contract — a dropped frame never fails the call.
    const progressToken = request.params._meta?.progressToken;
    // Raw-projection flag (§11.5): observe-tier tools report a raw
    // read through the context so the visibility entry can carry it.
    let rawRead = false;
    const callContext: McpToolCallContext = {
      ...context,
      markRawRead: () => {
        rawRead = true;
      },
      ...(progressToken === undefined
        ? {}
        : {
            progress: (update: { progress: number; total?: number; message?: string }) => {
              void extra
                .sendNotification({ method: 'notifications/progress', params: { progressToken, ...update } })
                .catch((err) => logger.info(SCOPE, `progress notification dropped (token=${context.tokenId})`, err));
            },
          }),
    };
    try {
      await gateMcpToolCall(tool, args, getPolicy(), callContext);
      const result = await tool.handler(args, callContext);
      if (tool.tier === 'observe' && onObserveCall !== undefined) {
        // Same resolution the gate authorized against (pure, cheap).
        const resolved = tool.resolveWorkspaceId(args);
        const workspaceIds =
          resolved === undefined || resolved === null ? [] : typeof resolved === 'string' ? [resolved] : [...resolved];
        try {
          onObserveCall({
            toolName: tool.name,
            workspaceIds,
            tokenId: context.tokenId,
            ...(context.tokenLabel !== undefined ? { tokenLabel: context.tokenLabel } : {}),
            userId: context.userId,
            ...(rawRead ? { raw: true } : {}),
          });
        } catch (err) {
          logger.warn(SCOPE, 'observe-visibility sink threw', err);
        }
      }
      return textResult(result);
    } catch (err) {
      if (err instanceof McpPermissionDeniedError || err instanceof McpToolInputError) {
        logger.info(SCOPE, `tool ${tool.name} rejected (token=${context.tokenId}): ${err.message}`);
        return errorResult(err.message);
      }
      logger.warn(SCOPE, `tool ${tool.name} failed (token=${context.tokenId})`, err);
      throw err;
    }
  });

  return server;
}
