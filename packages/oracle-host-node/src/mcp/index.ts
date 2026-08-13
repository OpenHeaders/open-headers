/**
 * Open Headers MCP server — a third inbound surface into the unified
 * oracle (alongside renderer IPC and the daemon WS server). Hosts wire
 * {@link createMcpHttpHandler} onto the daemon's bound socket via the
 * composable `httpRequestHandler` seam; tools read the same snapshots
 * and (Phase 2) write through the same `applySyncRequest` path every
 * other surface uses.
 */

export { createMcpHttpHandler, type McpHttpHandler, type McpHttpHandlerOptions } from './http-handler';
export { gateMcpToolCall, McpPermissionDeniedError, type McpPolicy } from './policy';
export {
  createMcpToolRegistry,
  MCP_SURFACE_ID,
  type McpToolCallContext,
  type McpToolDefinition,
  McpToolInputError,
  type McpToolRegistry,
  type McpToolTier,
} from './registry';
export { type CreateMcpServerOptions, createMcpServer, MCP_SERVER_NAME, type McpObserveCallEvent } from './server';
export { createDiffToolDefinitions } from './tools/diff-tools';
export {
  createExecuteToolDefinitions,
  type McpExecuteToolDeps,
  type McpWorkflowRunArgs,
  type McpWorkflowRunOutcome,
} from './tools/execute-tools';
export { createImportToolDefinitions } from './tools/import-tools';
export { createReadToolDefinitions } from './tools/read-tools';
export {
  createRunToolDefinitions,
  type McpRunItem,
  type McpRunToolDeps,
  type McpSuiteRunArgs,
  type McpSuiteRunEvent,
  type McpSuiteRunResult,
} from './tools/run-tools';
export { createRuntimeToolDefinitions } from './tools/runtime-tools';
export { createSecretToolDefinitions } from './tools/secret-tools';
export { createSessionToolDefinitions, type McpSessionToolDeps } from './tools/session-tools';
export { createTrafficToolDefinitions, type McpTrafficToolDeps } from './tools/traffic-tools';
export { createWriteToolDefinitions } from './tools/write-tools';
export {
  type McpUsageObserver,
  notifyMcpClientInitialized,
  notifyMcpRequestServed,
  setMcpUsageObserver,
} from './usage-observer';
