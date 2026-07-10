/**
 * Coverage for the MCP tool registry + policy gate: duplicate-name
 * rejection, tier gating, the workspace-resolution contract
 * (`null` = workspace-less check, array = every id must pass,
 * `undefined` = skip), and the per-call peer-subject resolution — the
 * gate decides as the CALLING user (operator localAdmin allow-all,
 * directory grants, unknown user fail-closed, revocation biting the
 * very next call) and audits that user as the actor.
 */

import {
  clearIdentitySnapshot,
  createDaemonUser,
  ensureSyntheticIdentity,
  grantWorkspaceRole,
  type ResolvedAuditEntry,
  refreshIdentitySnapshotFromHostStorage,
  resetAuditSink,
  revokeWorkspaceRole,
  setAuditSink,
} from '@openheaders/core/identity';
import { setHostStorage } from '@openheaders/core/storage';
import type { DaemonUserRecord } from '@openheaders/core/types';
import { queryAuditEntries, SqliteAuditLog } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gateMcpToolCall, McpPermissionDeniedError, type McpPolicy } from '../../src/mcp/policy';
import {
  createMcpToolRegistry,
  type McpToolCallContext,
  type McpToolDefinition,
  type McpToolTier,
} from '../../src/mcp/registry';
import { createHostStorageFake } from './_host-storage-fake';

const WS_ID = 'ws-openheaders-io';

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

function ctxOf(userId: string): McpToolCallContext {
  return { tokenId: 'tok-1', userId };
}

async function reasonOf(gate: Promise<void>): Promise<string> {
  try {
    await gate;
  } catch (err) {
    expect(err).toBeInstanceOf(McpPermissionDeniedError);
    return (err as McpPermissionDeniedError).reason;
  }
  return 'allowed';
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
  let operatorUserId = '';
  let audits: ResolvedAuditEntry[] = [];
  let auditDb: Database.Database;

  async function addUser(name: string, role: 'owner' | 'editor' | 'viewer' | null): Promise<DaemonUserRecord> {
    const created = await createDaemonUser({ displayName: name });
    if (!created.ok) throw new Error('directory create failed');
    if (role !== null) {
      await grantWorkspaceRole({ principalId: created.record.principal.id, workspaceId: WS_ID, role });
    }
    return created.record;
  }

  beforeEach(async () => {
    audits = [];
    // Dual sink — the array for in-test assertions, the SQLite log for
    // the slice-4 "denials land as queryable rows" leg (the same sink
    // shape the boot spine installs).
    auditDb = new Database(':memory:');
    const sqliteAudit = new SqliteAuditLog(auditDb);
    setAuditSink((entry) => {
      audits.push(entry);
      void sqliteAudit.append(entry);
    });
    setHostStorage(createHostStorageFake());
    const record = await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-10T00:00:00.000Z' });
    operatorUserId = record.user.id;
    await refreshIdentitySnapshotFromHostStorage();
  });

  afterEach(() => {
    resetAuditSink();
    auditDb.close();
    clearIdentitySnapshot();
  });

  it('denies a tool whose tier is not enabled', async () => {
    const tool = makeTool({ tier: 'secrets' });
    expect(await reasonOf(gateMcpToolCall(tool, {}, policyOf('read'), ctxOf(operatorUserId)))).toBe('tier-disabled');
  });

  it('skips the capability check when no workspace context resolves', async () => {
    const tool = makeTool({ resolveWorkspaceId: () => undefined });
    await expect(gateMcpToolCall(tool, {}, policyOf('read'), ctxOf('user-unknown'))).resolves.toBeUndefined();
  });

  it('allows the operator everywhere via localAdmin', async () => {
    const tool = makeTool({ tier: 'write', resolveWorkspaceId: () => 'ws-never-granted' });
    await expect(gateMcpToolCall(tool, {}, policyOf('write'), ctxOf(operatorUserId))).resolves.toBeUndefined();
    expect(audits.at(-1)).toMatchObject({ actorUserId: operatorUserId, decision: { allow: true } });
  });

  it('gates a directory user by their own grants, and audits them as the actor', async () => {
    const editor = await addUser('Editor', 'editor');
    const writeTool = makeTool({ tier: 'write', resolveWorkspaceId: () => WS_ID });
    await expect(gateMcpToolCall(writeTool, {}, policyOf('write'), ctxOf(editor.user.id))).resolves.toBeUndefined();
    expect(audits.at(-1)).toMatchObject({
      actorUserId: editor.user.id,
      capability: 'workspace.write',
      workspaceId: WS_ID,
      decision: { allow: true },
    });

    const elsewhere = makeTool({ tier: 'write', resolveWorkspaceId: () => 'ws-other' });
    expect(await reasonOf(gateMcpToolCall(elsewhere, {}, policyOf('write'), ctxOf(editor.user.id)))).toBe(
      'no-workspace-role-assignment',
    );
    expect(audits.at(-1)).toMatchObject({ actorUserId: editor.user.id, decision: { allow: false } });

    // Slice 4 — the denied MCP call is a QUERYABLE row in the durable
    // audit log, filtered exactly the way `oh daemon audit list
    // --decision deny` reads it, with the calling user as the actor.
    const deniedRows = queryAuditEntries(auditDb, { allow: false });
    expect(deniedRows).toHaveLength(1);
    expect(deniedRows[0]).toMatchObject({
      actorUserId: editor.user.id,
      capability: 'workspace.write',
      workspaceId: 'ws-other',
      decision: { allow: false, reason: 'no-workspace-role-assignment' },
    });
  });

  it('denies a viewer the write capability but allows the read', async () => {
    const viewer = await addUser('Viewer', 'viewer');
    const readTool = makeTool({ tier: 'read', resolveWorkspaceId: () => WS_ID });
    await expect(gateMcpToolCall(readTool, {}, policyOf('read'), ctxOf(viewer.user.id))).resolves.toBeUndefined();

    const writeTool = makeTool({ tier: 'write', resolveWorkspaceId: () => WS_ID });
    expect(await reasonOf(gateMcpToolCall(writeTool, {}, policyOf('write'), ctxOf(viewer.user.id)))).toBe(
      'insufficient-workspace-role',
    );
  });

  it('fails closed for an unknown user', async () => {
    const tool = makeTool({ resolveWorkspaceId: () => WS_ID });
    expect(await reasonOf(gateMcpToolCall(tool, {}, policyOf('read'), ctxOf('user-never-created')))).toBe(
      'no-current-user',
    );
  });

  it('keeps daemon.admin tools operator-only regardless of grants', async () => {
    const owner = await addUser('Owner', 'owner');
    const adminTool = makeTool({ tier: 'write', capability: 'daemon.admin', resolveWorkspaceId: () => WS_ID });
    await expect(gateMcpToolCall(adminTool, {}, policyOf('write'), ctxOf(operatorUserId))).resolves.toBeUndefined();
    expect(await reasonOf(gateMcpToolCall(adminTool, {}, policyOf('write'), ctxOf(owner.user.id)))).toBe(
      'not-daemon-admin',
    );
  });

  it('requires every workspace of an array resolution to pass', async () => {
    const viewer = await addUser('Viewer', 'viewer');
    const bothGranted = makeTool({ tier: 'read', resolveWorkspaceId: () => [WS_ID, WS_ID] });
    await expect(gateMcpToolCall(bothGranted, {}, policyOf('read'), ctxOf(viewer.user.id))).resolves.toBeUndefined();

    const oneDenied = makeTool({ tier: 'read', resolveWorkspaceId: () => [WS_ID, 'ws-other'] });
    expect(await reasonOf(gateMcpToolCall(oneDenied, {}, policyOf('read'), ctxOf(viewer.user.id)))).toBe(
      'no-workspace-role-assignment',
    );
  });

  it('re-resolves the snapshot per call — a revocation bites the next call', async () => {
    const editor = await addUser('Editor', 'editor');
    const tool = makeTool({ tier: 'write', resolveWorkspaceId: () => WS_ID });
    await expect(gateMcpToolCall(tool, {}, policyOf('write'), ctxOf(editor.user.id))).resolves.toBeUndefined();
    await revokeWorkspaceRole(editor.principal.id, WS_ID);
    expect(await reasonOf(gateMcpToolCall(tool, {}, policyOf('write'), ctxOf(editor.user.id)))).toBe(
      'no-workspace-role-assignment',
    );
  });

  it('denies a workspace-less capability check for an unknown user', async () => {
    const tool = makeTool({ capability: 'workspace.list', resolveWorkspaceId: () => null });
    expect(await reasonOf(gateMcpToolCall(tool, {}, policyOf('read'), ctxOf('user-never-created')))).toBe(
      'no-current-user',
    );
  });
});
