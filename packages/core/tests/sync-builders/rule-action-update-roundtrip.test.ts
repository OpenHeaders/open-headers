/**
 * Regression: editing a non-header rule's action and saving must
 * persist the edit (and clear the editor's derived-dirty state).
 *
 * `seedRule` (create) flattens the action to per-leaf field paths
 * (`action.statusCode`, `action.bodyType`, …). A later update that
 * wrote the whole action back as a single `setField` at `action` left
 * those create-time leaves in place; at materialize time
 * `unflattenLeaves` let the stale leaves clobber the edit — the saved
 * rule silently reverted to its create defaults and the form stayed
 * forever-dirty (form value !== materialized canonical). The hazard is
 * called out in rule-projection.ts. `buildUpdateBatch` now mirrors
 * create's per-leaf granularity for non-header actions.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutatorContext } from '../../src/sync';
import { buildAddBatch, buildUpdateBatch, type RuleMutationPayload } from '../../src/sync-builders/mutations/rule-mutations';
import type { RedirectRule, ResponseRule, Rule } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function applyBatch(store: InMemoryDocumentStore, payload: RuleMutationPayload): void {
  for (const env of payload.batch.mutations) store.apply(env);
}

const responseSeed: ResponseRule = {
  schemaVersion: 5,
  uid: 'rule-1',
  path: 'rules/Response',
  name: 'Response',
  enabled: true,
  type: 'response',
  conditions: [],
  action: {
    responseSource: 'mock',
    bodyType: 'static',
    responseBody: '',
    statusCode: 200,
    contentType: 'application/json',
    responseHeaders: {},
  },
};

describe('non-header rule action update round-trip', () => {
  it('persists every edited response action leaf instead of reverting to create defaults', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(responseSeed, ctx(1_000)));

    const editedAction: ResponseRule['action'] = {
      responseSource: 'network', // flipped mock → network
      statusCode: 0, // "keep original status code" sentinel
      responseBody: 'function modifyResponse(args) { return args.response; }',
      contentType: 'application/json',
      responseHeaders: {},
      bodyType: 'dynamic',
      resourceType: 'rest',
      graphqlFilter: undefined,
    };
    applyBatch(
      store,
      buildUpdateBatch('rule-1', 'response', { action: editedAction }, ctx(2_000), () => []),
    );

    const data = store.materializeOne('rule', 'rule-1')?.data as Rule;
    expect(data.type).toBe('response');
    const action = (data as ResponseRule).action;
    expect(action.responseSource).toBe('network');
    expect(action.statusCode).toBe(0);
    expect(action.bodyType).toBe('dynamic');
    expect(action.responseBody).toBe('function modifyResponse(args) { return args.response; }');
    expect(action.resourceType).toBe('rest');
    expect(action.contentType).toBe('application/json');
    expect(action.responseHeaders).toEqual({});
    // Undefined optional leaves never travel — graphqlFilter stays absent.
    expect('graphqlFilter' in action).toBe(false);
  });

  it('a second update supersedes the first (no stale residue)', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(responseSeed, ctx(1_000)));
    applyBatch(
      store,
      buildUpdateBatch(
        'rule-1',
        'response',
        { action: { ...responseSeed.action, statusCode: 0, bodyType: 'dynamic', responseBody: 'A' } },
        ctx(2_000),
        () => [],
      ),
    );
    applyBatch(
      store,
      buildUpdateBatch(
        'rule-1',
        'response',
        { action: { ...responseSeed.action, statusCode: 404, bodyType: 'static', responseBody: 'B' } },
        ctx(3_000),
        () => [],
      ),
    );

    const action = (store.materializeOne('rule', 'rule-1')?.data as ResponseRule).action;
    expect(action.statusCode).toBe(404);
    expect(action.bodyType).toBe('static');
    expect(action.responseBody).toBe('B');
  });

  it('persists a redirect target edit (scalar non-header action)', () => {
    const redirectSeed: RedirectRule = {
      schemaVersion: 5,
      uid: 'rule-2',
      path: 'rules/Redirect',
      name: 'Redirect',
      enabled: true,
      type: 'redirect',
      conditions: [],
      action: { redirectTo: '' },
    };
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(redirectSeed, ctx(1_000)));
    applyBatch(
      store,
      buildUpdateBatch(
        'rule-2',
        'redirect',
        { action: { redirectTo: 'https://api.openheaders.io/v2' } },
        ctx(2_000),
        () => [],
      ),
    );

    const action = (store.materializeOne('rule', 'rule-2')?.data as RedirectRule).action;
    expect(action.redirectTo).toBe('https://api.openheaders.io/v2');
  });
});
