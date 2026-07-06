/**
 * Coverage for the write-tier MCP tools: batch mint + apply through the
 * real sync service (in-memory persistence), the `published` carry on
 * atomic gestures, schema validation of agent input, row-uid minting,
 * name-keyed variable upserts, and the ensure-on-demand default request
 * collection. Handlers are called directly — the tier/capability gate
 * has its own suite in `mcp-registry-policy.test.ts`.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import type { MutatorContext } from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import type { Collection, HeaderRule, Request, Rule } from '@openheaders/core/types';
import { logger as consoleLogger, generateUid } from '@openheaders/core/utils';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
  snapshotEnvironmentPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestPostStates,
  snapshotRulePostStates,
  snapshotWorkspaceVariablesPostStates,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type McpToolDefinition, McpToolInputError } from '../../src/mcp/registry';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-mcp-write';
const CTX = { tokenId: 'token-1' };

const tools = new Map<string, McpToolDefinition>(createWriteToolDefinitions().map((t) => [t.name, t]));

// No oracle host hooks in the unit harness, so the runtime-active
// fallback is unavailable — every call passes the workspace explicitly.
function call(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler({ workspaceId: wsId, ...args }, CTX);
}

const seedCtx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'seed' },
  surfaceId: 'sw',
  deviceId: 'd0',
});

async function seedRuleCollection(): Promise<Collection> {
  const uid = generateUid();
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `rules/my-rules-${uid}`,
    name: 'My Rules',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const oracle = getOracleForCurrentWorkspace();
  if (!oracle) throw new Error('no oracle');
  await oracle.apply(seedCollection(collection, seedCtx(1_000)), []);
  return collection;
}

const HEADER_RULE_INPUT = {
  name: 'API key header',
  type: 'header',
  enabled: true,
  conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
  action: {
    requestHeaders: [{ operation: 'override', headerName: 'X-Api-Key', value: 'abc' }],
    responseHeaders: [],
  },
};

async function createHeaderRule(overrides: Record<string, unknown> = {}): Promise<Rule> {
  const result = (await call('rules_create', { rule: { ...HEADER_RULE_INPUT, ...overrides } })) as { rule: Rule };
  return result.rule;
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
});

afterEach(() => {
  disposeSyncService();
});

describe('rules_create', () => {
  it('mints uid/path/row-uids, starts draft, and lands in the snapshot', async () => {
    const collection = await seedRuleCollection();
    const rule = (await createHeaderRule()) as HeaderRule;

    expect(rule.uid).toBeTruthy();
    expect(rule.path.startsWith(`${collection.path}/`)).toBe(true);
    expect(rule.published).toBe(false);
    expect(rule.conditions[0].uid).toBeTruthy();
    expect(rule.action.requestHeaders[0].uid).toBeTruthy();

    const snapshot = snapshotRulePostStates(wsId);
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].rule.name).toBe('API key header');
    expect(snapshot[0].rule.published).toBeFalsy();
  });

  it('respects an explicit published: true', async () => {
    await seedRuleCollection();
    const rule = await createHeaderRule({ published: true });
    expect(rule.published).toBe(true);
    expect(snapshotRulePostStates(wsId)[0].rule.published).toBe(true);
  });

  it('rejects a rule that fails the canonical schema', async () => {
    await seedRuleCollection();
    await expect(call('rules_create', { rule: { ...HEADER_RULE_INPUT, type: 'not-a-type' } })).rejects.toThrow(
      McpToolInputError,
    );
  });

  it('rejects entity-managed fields in the payload', async () => {
    await seedRuleCollection();
    await expect(call('rules_create', { rule: { ...HEADER_RULE_INPUT, uid: 'attacker-picked' } })).rejects.toThrow(
      /entity-managed/,
    );
  });

  it('mints the default rule collection when the workspace has none', async () => {
    const result = (await call('rules_create', { rule: HEADER_RULE_INPUT })) as { rule: Rule };
    expect(result.rule.path.startsWith('rules/')).toBe(true);
    expect(snapshotRulePostStates(wsId)).toHaveLength(1);
  });

  it('errors on an unknown collectionUid', async () => {
    await expect(call('rules_create', { rule: HEADER_RULE_INPUT, collectionUid: 'ghost' })).rejects.toThrow(
      /no rule collection with uid/,
    );
  });
});

describe('rules_toggle', () => {
  it('flips enabled and keeps a published rule published in the same batch', async () => {
    await seedRuleCollection();
    const rule = await createHeaderRule({ published: true });

    const result = (await call('rules_toggle', { uid: rule.uid, enabled: false })) as Record<string, unknown>;
    expect(result.enabled).toBe(false);
    expect(result.published).toBe(true);

    const [after] = snapshotRulePostStates(wsId);
    expect(after.rule.enabled).toBe(false);
    expect(after.rule.published).toBe(true);
  });

  it('leaves a draft rule in draft', async () => {
    await seedRuleCollection();
    const rule = await createHeaderRule();
    await call('rules_toggle', { uid: rule.uid, enabled: false });
    const [after] = snapshotRulePostStates(wsId);
    expect(after.rule.enabled).toBe(false);
    expect(after.rule.published).toBeFalsy();
  });
});

describe('rules_update', () => {
  it('applies a patch and carries published: true on a published rule', async () => {
    await seedRuleCollection();
    const rule = await createHeaderRule({ published: true });

    await call('rules_update', { uid: rule.uid, updates: { name: 'Renamed rule' } });

    const [after] = snapshotRulePostStates(wsId);
    expect(after.rule.name).toBe('Renamed rule');
    expect(after.rule.published).toBe(true);
  });

  it('lets an explicit published: false drop the rule to draft', async () => {
    await seedRuleCollection();
    const rule = await createHeaderRule({ published: true });
    await call('rules_update', { uid: rule.uid, updates: { name: 'Drafted', published: false } });
    const [after] = snapshotRulePostStates(wsId);
    expect(after.rule.published).toBeFalsy();
  });

  it('diffs set-modeled condition rows through the oracle', async () => {
    await seedRuleCollection();
    const rule = await createHeaderRule();
    await call('rules_update', {
      uid: rule.uid,
      updates: {
        conditions: [
          { type: 'url-filter', values: ['https://app.openheaders.io/*'] },
          { type: 'request-methods', values: ['POST'] },
        ],
      },
    });
    const [after] = snapshotRulePostStates(wsId);
    expect(after.rule.conditions).toHaveLength(2);
    expect(after.rule.conditions.map((c) => c.type).sort()).toEqual(['request-methods', 'url-filter']);
  });

  it('rejects a patch that breaks the merged schema', async () => {
    await seedRuleCollection();
    const rule = await createHeaderRule();
    await expect(call('rules_update', { uid: rule.uid, updates: { enabled: 'yes' } })).rejects.toThrow(
      McpToolInputError,
    );
  });

  it('errors on an unknown uid', async () => {
    await expect(call('rules_update', { uid: 'missing', updates: { name: 'x' } })).rejects.toThrow(/no rule with uid/);
  });
});

describe('rules_delete', () => {
  it('tombstones the rule', async () => {
    await seedRuleCollection();
    const rule = await createHeaderRule();
    const result = (await call('rules_delete', { uid: rule.uid })) as Record<string, unknown>;
    expect(result.deleted).toBe(true);
    expect(snapshotRulePostStates(wsId)).toHaveLength(0);
  });
});

describe('environments_create / environments_edit', () => {
  it('creates an environment with minted variable rows', async () => {
    await call('environments_create', {
      name: 'Staging',
      variables: [{ name: 'baseUrl', value: 'https://staging.openheaders.io' }],
    });
    const [env] = snapshotEnvironmentPostStates(wsId);
    expect(env.environment.name).toBe('Staging');
    expect(env.environment.variables).toHaveLength(1);
    expect(env.environment.variables[0].uid).toBeTruthy();
    expect(env.environment.variables[0].type).toBe('default');
  });

  it('renames + upserts + removes in one atomic batch, keyed by name', async () => {
    await call('environments_create', {
      name: 'Staging',
      variables: [
        { name: 'baseUrl', value: 'https://staging.openheaders.io' },
        { name: 'obsolete', value: 'x' },
      ],
    });
    const [before] = snapshotEnvironmentPostStates(wsId);
    const baseUrlUid = before.environment.variables.find((row) => row.name === 'baseUrl')?.uid;

    await call('environments_edit', {
      uid: before.environment.uid,
      name: 'Production',
      setVariables: [
        { name: 'baseUrl', value: 'https://openheaders.io' },
        { name: 'apiKey', value: 's3cret', type: 'secret' },
      ],
      removeVariables: ['obsolete'],
    });

    const [after] = snapshotEnvironmentPostStates(wsId);
    expect(after.environment.name).toBe('Production');
    const byName = new Map(after.environment.variables.map((row) => [row.name, row]));
    expect(byName.size).toBe(2);
    expect(byName.get('baseUrl')?.value).toBe('https://openheaders.io');
    expect(byName.get('baseUrl')?.uid).toBe(baseUrlUid);
    expect(byName.get('apiKey')?.type).toBe('secret');
  });

  it('errors when removing an unknown variable name', async () => {
    await call('environments_create', { name: 'Staging' });
    const [env] = snapshotEnvironmentPostStates(wsId);
    await expect(call('environments_edit', { uid: env.environment.uid, removeVariables: ['ghost'] })).rejects.toThrow(
      /no variable named 'ghost'/,
    );
  });
});

describe('variables_set', () => {
  it('creates then updates a workspace variable, reusing the row uid', async () => {
    await call('variables_set', { name: 'region', value: 'eu-west' });
    const first = snapshotWorkspaceVariablesPostStates(wsId)
      .flatMap((ps) => ps.workspaceVariables.variables)
      .find((row) => row.name === 'region');
    expect(first?.value).toBe('eu-west');

    const result = (await call('variables_set', { name: 'region', value: 'us-east' })) as {
      variable: { updated: boolean };
    };
    expect(result.variable.updated).toBe(true);

    const rows = snapshotWorkspaceVariablesPostStates(wsId)
      .flatMap((ps) => ps.workspaceVariables.variables)
      .filter((row) => row.name === 'region');
    expect(rows).toHaveLength(1);
    expect(rows[0].uid).toBe(first?.uid);
    expect(rows[0].value).toBe('us-east');
  });
});

describe('requests_save', () => {
  it('creates a request, minting the default collection when none exists', async () => {
    const result = (await call('requests_save', {
      request: { name: 'Echo', method: 'POST', url: 'http://127.0.0.1:3000/api/echo' },
    })) as { request: { uid: string; path: string } };

    const collections = snapshotRequestCollectionPostStates(wsId);
    expect(collections).toHaveLength(1);
    expect(collections[0].collection.name).toBe('My Requests');
    expect(result.request.path.startsWith(`${collections[0].collection.path}/`)).toBe(true);

    const [saved] = snapshotRequestPostStates(wsId);
    expect(saved.request.method).toBe('POST');
    expect(saved.request.auth).toEqual({ type: 'inherit' });
    expect(saved.request.body).toEqual({ type: 'none' });
  });

  it('patches an existing request by uid', async () => {
    const created = (await call('requests_save', {
      request: { name: 'Echo', url: 'http://127.0.0.1:3000/api/echo' },
    })) as { request: { uid: string } };

    await call('requests_save', {
      uid: created.request.uid,
      request: {
        url: 'http://127.0.0.1:3000/api/echo?v=2',
        headers: [{ key: 'X-Trace', value: 'on', enabled: true }],
      },
    });

    const [after] = snapshotRequestPostStates(wsId);
    expect(after.request.url).toBe('http://127.0.0.1:3000/api/echo?v=2');
    expect(after.request.headers).toHaveLength(1);
    expect(after.request.headers[0].uid).toBeTruthy();
    expect(snapshotRequestPostStates(wsId)).toHaveLength(1);
  });

  it('rejects an invalid request payload', async () => {
    await expect(call('requests_save', { request: { name: 'Bad', url: 'x', body: { type: 'json' } } })).rejects.toThrow(
      McpToolInputError,
    );
  });
});
