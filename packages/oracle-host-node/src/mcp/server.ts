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

export interface CreateMcpServerOptions {
  readonly registry: McpToolRegistry;
  readonly getPolicy: () => McpPolicy;
  /** Host app version, announced in the MCP `initialize` response. */
  readonly serverVersion: string;
  /** Token identity of the authenticated client this server serves. */
  readonly context: McpToolCallContext;
}

function textResult(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function createMcpServer(options: CreateMcpServerOptions): Server {
  const { registry, getPolicy, serverVersion, context } = options;

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
    const callContext: McpToolCallContext =
      progressToken === undefined
        ? context
        : {
            ...context,
            progress: (update) => {
              void extra
                .sendNotification({ method: 'notifications/progress', params: { progressToken, ...update } })
                .catch((err) => logger.info(SCOPE, `progress notification dropped (token=${context.tokenId})`, err));
            },
          };
    try {
      await gateMcpToolCall(tool, args, getPolicy(), callContext);
      const result = await tool.handler(args, callContext);
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
