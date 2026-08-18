/**
 * MCP policy gate — the per-call decision layer between the transport
 * and a tool handler.
 *
 * Two checks, in order:
 *
 *   1. Tier gate. The host controls which tool families are enabled
 *      (`read` rides the master switch; `observe` / `write` / `execute`
 *      / `secrets` are separate opt-ins). A disabled tier denies before
 *      any workspace context is even resolved.
 *   2. Capability gate. Same discipline as oracle's `gateDispatch`
 *      (the unified-oracle model §5.8): resolve the workspaceId(s) the
 *      tool acts on, consult {@link hasCapability} against the CALLING
 *      USER's snapshot, and emit an audit entry on every decision. The
 *      snapshot is re-resolved per call (`resolveDaemonPeerIdentitySnapshot`,
 *      never cached) so a grant or revocation bites in-flight clients on
 *      their very next call — the same freshness law the WS gates hold.
 *      The operator resolves to the registry snapshot (localAdmin ⇒
 *      allow-all); a directory user resolves to their own grants;
 *      unknown/deactivated resolves null ⇒ deny fail-closed.
 *      An unresolvable workspace (`undefined`) skips the check — the
 *      handler degrades on its own rather than the gate synthesizing a
 *      deny that reflects no real privilege decision.
 *
 * Denials throw {@link McpPermissionDeniedError}; the server layer
 * surfaces them as in-band tool errors so the agent reads the reason
 * (e.g. "enable Write access in Settings → MCP") instead of a bare
 * protocol failure.
 */

import {
  type Capability,
  emitAuditEntry,
  hasCapability,
  resolveDaemonPeerIdentitySnapshot,
} from '@openheaders/core/identity';
import type { McpToolCallContext, McpToolDefinition, McpToolTier } from './registry';

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
  observe: 'Traffic observation',
  write: 'Write',
  execute: 'Execute',
  secrets: 'Secrets',
};

function defaultCapabilityForTier(tier: McpToolTier): Capability {
  if (tier === 'write' || tier === 'execute') return 'workspace.write';
  if (tier === 'observe') return 'workspace.observe';
  return 'workspace.read';
}

/**
 * Gate a tool call as the calling user. Returns normally on allow;
 * throws {@link McpPermissionDeniedError} on deny.
 */
export async function gateMcpToolCall(
  tool: McpToolDefinition,
  args: Record<string, unknown>,
  policy: McpPolicy,
  ctx: McpToolCallContext,
): Promise<void> {
  if (!policy.enabledTiers.has(tool.tier)) {
    throw new McpPermissionDeniedError(
      `${TIER_LABEL[tool.tier]} tools are disabled on this host. Enable them in Open Headers → Settings → MCP.`,
      'tier-disabled',
    );
  }

  const resolved = tool.resolveWorkspaceId(args);
  if (resolved === undefined) return;
  const workspaceIds: readonly (string | null)[] =
    resolved === null ? [null] : typeof resolved === 'string' ? [resolved] : resolved;

  const capability = tool.capability ?? defaultCapabilityForTier(tool.tier);
  const snapshot = await resolveDaemonPeerIdentitySnapshot(ctx.userId);
  for (const workspaceId of workspaceIds) {
    const decision = hasCapability(snapshot, capability, workspaceId === null ? {} : { workspaceId });
    emitAuditEntry({
      actorUserId: ctx.userId,
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
}
