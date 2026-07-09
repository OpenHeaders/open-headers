/**
 * Coverage for `workspaces_diff` — entity-family diff between two
 * materialized workspaces. Identity is the entity uid (name for the
 * name-keyed singleton families), so the `changed` bucket is exercised
 * by seeding the SAME uid into both workspaces with differing content.
 * Output must carry identity only — never entity content.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import type { MutatorContext } from '@openheaders/core/sync';
import { buildAddBatch as buildAddRuleBatch } from '@openheaders/core/sync-builders/mutations/rule-mutations';
import type { Rule } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOracleForWorkspace,
  getOrCreateWorkspaceService,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { McpToolDefinition } from '../../src/mcp/registry';
import { createDiffToolDefinitions } from '../../src/mcp/tools/diff-tools';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsA = 'ws-diff-a';
const wsB = 'ws-diff-b';
const CTX = { tokenId: 'token-1', userId: 'user-1' };

const tools = new Map<string, McpToolDefinition>(
  [...createWriteToolDefinitions(), ...createDiffToolDefinitions()].map((t) => [t.name, t]),
);

function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler(args, CTX) as Promise<Record<string, unknown>>;
}

const seedCtx = (workspaceId: string, ms: number): MutatorContext => ({
  workspaceId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'seed' },
  surfaceId: 'sw',
  deviceId: 'd0',
});

const RULE_INPUT = {
  name: 'API key header',
  type: 'header',
  enabled: true,
  conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
  action: {
    requestHeaders: [{ operation: 'override', headerName: 'X-Api-Key', value: 'abc' }],
    responseHeaders: [],
  },
};

interface FamilyDiff {
  added: Array<{ id: string; name: string }>;
  removed: Array<{ id: string; name: string }>;
  changed: Array<{ id: string; name: string }>;
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsA);
  getOrCreateWorkspaceService(wsB);
});

afterEach(() => {
  disposeSyncService();
});

describe('workspaces_diff', () => {
  it('classifies added, removed, and changed entities across families', async () => {
    // Rule in BOTH workspaces under the same uid, with content drift in B.
    const created = (await call('rules_create', { workspaceId: wsA, rule: RULE_INPUT })) as { rule: Rule };
    const oracleB = getOracleForWorkspace(wsB);
    if (!oracleB) throw new Error('wsB not materialized');
    const drifted = { ...created.rule, name: 'API key header (renamed)' };
    const payload = buildAddRuleBatch(drifted, seedCtx(wsB, 1_000));
    const applied = await oracleB.apply(payload.batch, payload.sideEffects);
    expect(applied.ok).toBe(true);

    // Request only in A; environment only in B.
    await call('requests_save', {
      workspaceId: wsA,
      request: { name: 'Echo', url: 'https://api.openheaders.io/echo' },
    });
    const env = (await call('environments_create', { workspaceId: wsB, name: 'Staging' })) as {
      environment: { uid: string };
    };

    const result = (await call('workspaces_diff', { workspaceId: wsA, otherWorkspaceId: wsB })) as {
      diff: Record<string, FamilyDiff>;
    };

    expect(result.diff.rules.changed).toEqual([{ id: created.rule.uid, name: created.rule.name }]);
    expect(result.diff.rules.added).toEqual([]);
    expect(result.diff.requests.removed.map((row) => row.name)).toEqual(['Echo']);
    expect(result.diff.environments.added).toEqual([{ id: env.environment.uid, name: 'Staging' }]);
    // Identity only — the drifted rule content never leaves the tool.
    expect(JSON.stringify(result.diff)).not.toContain('X-Api-Key');
  });

  it('reports identical workspaces as fully unchanged', async () => {
    const result = (await call('workspaces_diff', { workspaceId: wsA, otherWorkspaceId: wsB })) as {
      diff: Record<string, FamilyDiff>;
    };
    for (const family of Object.values(result.diff)) {
      expect(family).toEqual({ added: [], removed: [], changed: [] });
    }
  });

  it('errors on an unknown comparison workspace', async () => {
    await expect(call('workspaces_diff', { workspaceId: wsA, otherWorkspaceId: 'ghost' })).rejects.toThrow(
      /workspaces_list/,
    );
  });
});
