/**
 * Schema-aware empty-set canonicalization (regression for the v5
 * "fresh-install Vault crashed totp-scheduler" bug).
 *
 * Locks two contracts:
 *   - declared `setPaths` always surface in materialized data, as `[]`
 *     when no live entries exist;
 *   - the function form of `setPaths` receives the field-value-only
 *     partial so conditional schemas can branch on the entity
 *     discriminant (`Rule.action.*` only on `type: 'header'`).
 */

import { describe, expect, it } from 'vitest';
import {
  type EntitySchemaRegistry,
  InMemoryDocumentStore,
  type MutationEnvelope,
  newMutationId,
} from '../../../src/sync';

const env = (body: MutationEnvelope['body'], ms: number): MutationEnvelope => ({
  mutationId: newMutationId(),
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body,
});

describe('materialize empty-set canonicalization', () => {
  it('emits [] at declared setPaths when no addToSet ever ran (the fresh-install case)', () => {
    const schemas: EntitySchemaRegistry = new Map([['vault', { setPaths: ['secrets'] }]]);
    const store = new InMemoryDocumentStore(schemas);
    store.apply(env({ kind: 'create', type: 'vault', id: 'vault', payload: { schemaVersion: 5 } }, 1_000));
    const data = store.materializeOne('vault', 'vault')?.data as { schemaVersion: number; secrets: unknown[] };
    expect(data.secrets).toEqual([]);
  });

  it('emits [] at declared setPaths after every entry has been removed (post-removal case)', () => {
    const schemas: EntitySchemaRegistry = new Map([['vault', { setPaths: ['secrets'] }]]);
    const store = new InMemoryDocumentStore(schemas);
    store.apply(env({ kind: 'create', type: 'vault', id: 'vault', payload: { schemaVersion: 5 } }, 1_000));
    store.apply(
      env(
        { kind: 'addToSet', type: 'vault', id: 'vault', path: 'secrets', itemId: 'API_KEY', item: { name: 'API_KEY' } },
        2_000,
      ),
    );
    store.apply(env({ kind: 'removeFromSet', type: 'vault', id: 'vault', path: 'secrets', itemId: 'API_KEY' }, 3_000));
    const data = store.materializeOne('vault', 'vault')?.data as { secrets: unknown[] };
    expect(data.secrets).toEqual([]);
  });

  it('without a schema, untouched set paths stay absent (legacy behaviour preserved)', () => {
    const store = new InMemoryDocumentStore();
    store.apply(env({ kind: 'create', type: 'vault', id: 'vault', payload: { schemaVersion: 5 } }, 1_000));
    const data = store.materializeOne('vault', 'vault')?.data as Record<string, unknown>;
    expect('secrets' in data).toBe(false);
  });

  it('function-form setPaths receives the partial data and can branch on a discriminant', () => {
    const schemas: EntitySchemaRegistry = new Map([
      [
        'rule',
        {
          setPaths: (partial: unknown): readonly string[] => {
            if (
              typeof partial === 'object' &&
              partial !== null &&
              !Array.isArray(partial) &&
              (partial as { type?: unknown }).type === 'header'
            ) {
              return ['conditions', 'action.requestHeaders', 'action.responseHeaders'];
            }
            return ['conditions'];
          },
        },
      ],
    ]);
    const store = new InMemoryDocumentStore(schemas);

    store.apply(env({ kind: 'create', type: 'rule', id: 'r1', payload: { type: 'header', action: {} } }, 1_000));
    store.apply(env({ kind: 'create', type: 'rule', id: 'r2', payload: { type: 'response' } }, 1_000));

    const headerRule = store.materializeOne('rule', 'r1')?.data as {
      conditions: unknown[];
      action: { requestHeaders: unknown[]; responseHeaders: unknown[] };
    };
    expect(headerRule.conditions).toEqual([]);
    expect(headerRule.action.requestHeaders).toEqual([]);
    expect(headerRule.action.responseHeaders).toEqual([]);

    const mockRule = store.materializeOne('rule', 'r2')?.data as Record<string, unknown> & {
      conditions: unknown[];
    };
    expect(mockRule.conditions).toEqual([]);
    // Non-header variants must NOT grow the header-only paths on their action.
    expect('action' in mockRule).toBe(false);
  });
});
