/**
 * Coverage for the MCP tool registry + policy gate: duplicate-name
 * rejection, tier gating, the workspace-resolution contract
 * (`null` = workspace-less capability check, `undefined` = skip), and
 * capability denial against a missing identity snapshot.
 */

import { clearIdentitySnapshot } from '@openheaders/core/identity';
import { afterEach, describe, expect, it } from 'vitest';
import { gateMcpToolCall, McpPermissionDeniedError, type McpPolicy } from '../../src/mcp/policy';
import { createMcpToolRegistry, type McpToolDefinition, type McpToolTier } from '../../src/mcp/registry';

function makeTool(overrides: Partial<McpToolDefinition> = {}): McpToolDefinition {
  return {
    name: 'stub_tool',
    title: 'Stub',
    description: 'test stub',
    inputSchema: { type: 'object', properties: {} },
    tier: 'read',
    resolveWorkspaceId: () => undefined,
    handler: async () => ({ ok: true }),
    ...overrides,
  };
}

function policyOf(...tiers: McpToolTier[]): McpPolicy {
  return { enabledTiers: new Set(tiers) };
}

describe('createMcpToolRegistry', () => {
  it('lists registered tools and resolves by name', () => {
    const registry = createMcpToolRegistry([makeTool(), makeTool({ name: 'other_tool' })]);
    expect(registry.list().map((t) => t.name)).toEqual(['stub_tool', 'other_tool']);
    expect(registry.get('other_tool')?.name).toBe('other_tool');
    expect(registry.get('missing_tool')).toBeUndefined();
  });

  it('throws on duplicate tool names', () => {
    expect(() => createMcpToolRegistry([makeTool(), makeTool()])).toThrow(/duplicate MCP tool name/);
  });
});

describe('gateMcpToolCall', () => {
  afterEach(() => {
    clearIdentitySnapshot();
  });

  it('denies a tool whose tier is not enabled', () => {
    const tool = makeTool({ tier: 'secrets' });
    expect(() => gateMcpToolCall(tool, {}, policyOf('read'))).toThrow(McpPermissionDeniedError);
    try {
      gateMcpToolCall(tool, {}, policyOf('read'));
    } catch (err) {
      expect((err as McpPermissionDeniedError).reason).toBe('tier-disabled');
    }
  });

  it('skips the capability check when no workspace context resolves', () => {
    clearIdentitySnapshot();
    const tool = makeTool({ resolveWorkspaceId: () => undefined });
    expect(() => gateMcpToolCall(tool, {}, policyOf('read'))).not.toThrow();
  });

  it('denies a workspace-scoped call when no identity snapshot is installed', () => {
    clearIdentitySnapshot();
    const tool = makeTool({ resolveWorkspaceId: () => 'ws-openheaders-io' });
    try {
      gateMcpToolCall(tool, {}, policyOf('read'));
      expect.unreachable('gate should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(McpPermissionDeniedError);
      expect((err as McpPermissionDeniedError).reason).toBe('no-current-user');
    }
  });

  it('denies a workspace-less capability check without a snapshot', () => {
    clearIdentitySnapshot();
    const tool = makeTool({ capability: 'workspace.list', resolveWorkspaceId: () => null });
    expect(() => gateMcpToolCall(tool, {}, policyOf('read'))).toThrow(/no-current-user/);
  });
});
