/**
 * MCP policy gate — the per-call decision layer between the transport
 * and a tool handler.
 *
 * Two checks, in order:
 *
 *   1. Tier gate. The host controls which tool families are enabled
 *      (`read` rides the master switch; `write` / `execute` / `secrets`
 *      are separate opt-ins). A disabled tier denies before any
 *      workspace context is even resolved.
 *   2. Capability gate. Same discipline as oracle's `gateDispatch`
 *      (UNIFIED_ORACLE_MODEL.md §5.8): resolve the workspaceId the tool
 *      acts on, consult {@link hasCapability} against the installed
 *      identity snapshot, and emit an audit entry on every decision.
 *      An unresolvable workspace (`undefined`) skips the check — the
 *      handler degrades on its own rather than the gate synthesizing a
 *      deny that reflects no real privilege decision.
 *
 * Denials throw {@link McpPermissionDeniedError}; the server layer
 * surfaces them as in-band tool errors so the agent reads the reason
 * (e.g. "enable Write access in Settings → MCP") instead of a bare
 * protocol failure.
 */

import { type Capability, emitAuditEntry, getIdentitySnapshot, hasCapability } from '@openheaders/core/identity';
import type { McpToolDefinition, McpToolTier } from './registry';

export interface McpPolicy {
  /** Tool families the host currently allows. */
  readonly enabledTiers: ReadonlySet<McpToolTier>;
}

export class McpPermissionDeniedError extends Error {
  readonly reason: string;

  constructor(message: string, reason: string) {
    super(message);
    this.name = 'McpPermissionDeniedError';
    this.reason = reason;
  }
}

const TIER_LABEL: Record<McpToolTier, string> = {
  read: 'Read',
  write: 'Write',
  execute: 'Execute',
  secrets: 'Secrets',
};

function defaultCapabilityForTier(tier: McpToolTier): Capability {
  return tier === 'write' || tier === 'execute' ? 'workspace.write' : 'workspace.read';
}

/**
 * Gate a tool call. Returns normally on allow; throws
 * {@link McpPermissionDeniedError} on deny.
 */
export function gateMcpToolCall(tool: McpToolDefinition, args: Record<string, unknown>, policy: McpPolicy): void {
  if (!policy.enabledTiers.has(tool.tier)) {
    throw new McpPermissionDeniedError(
      `${TIER_LABEL[tool.tier]} tools are disabled on this host. Enable them in Open Headers → Settings → MCP.`,
      'tier-disabled',
    );
  }

  const workspaceId = tool.resolveWorkspaceId(args);
  if (workspaceId === undefined) return;

  const capability = tool.capability ?? defaultCapabilityForTier(tool.tier);
  const snapshot = getIdentitySnapshot();
  const ctx = workspaceId === null ? {} : { workspaceId };
  const decision = hasCapability(snapshot, capability, ctx);
  emitAuditEntry({
    actorUserId: snapshot?.user.id ?? 'unknown',
    capability,
    ...(workspaceId ? { workspaceId } : {}),
    decision,
  });
  if (!decision.allow) {
    throw new McpPermissionDeniedError(
      `permission denied: ${capability}${workspaceId ? ` on ${workspaceId}` : ''} (${decision.reason ?? 'denied'})`,
      decision.reason ?? 'denied',
    );
  }
}
