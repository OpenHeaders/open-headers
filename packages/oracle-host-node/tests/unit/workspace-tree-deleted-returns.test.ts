/**
 * A deleted entity's create set aside — which batches go on, which files
 * are held off the baseline, which rows are raised. Pure: batches and a
 * listing in, no disk.
 */

import type { MutationBody } from '@openheaders/core/sync';
import { bodiesBatch, type EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Environment } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { DELETED_RETURN_MESSAGE, setAsideDeletedReturns } from '../../src/workspace-tree/deleted-returns';

const batchOf = (label: string, bodies: MutationBody[]): EmissionBatch =>
  bodiesBatch(label, bodies, {
    workspaceId: 'wsaaaaaa',
    orgId: '019637a2-7b9a-7b9a-8b9a-1234567890ab',
    hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-tree' },
    surfaceId: 'tree',
    deviceId: 'device-a',
  });

const RULE_FILE = 'rules/block-probes-aaaaaaaa/rule.yaml';
const RULE_TEXT = 'schemaVersion: 5\nuid: aaaaaaaa\nname: Block probes\n';

describe('setAsideDeletedReturns', () => {
  it('with nothing deleted every batch goes on and no file is held', () => {
    const batches = [
      batchOf('rule:aaaaaaaa (create)', [{ kind: 'create', type: 'rule', id: 'aaaaaaaa', payload: {} }]),
    ];
    const returns = setAsideDeletedReturns({
      batches,
      files: [{ path: RULE_FILE, content: RULE_TEXT }],
      changedPaths: new Set([RULE_FILE]),
      environments: [],
      isDeleted: () => false,
    });
    expect(returns.batches).toEqual(batches);
    expect(returns.issues).toEqual([]);
    expect(returns.holds(RULE_FILE)).toBe(false);
  });

  it('a deleted entity’s create is set aside with its slot, its whole directory held, a row at its manifest', () => {
    const create = batchOf('rule:aaaaaaaa (create)', [
      { kind: 'create', type: 'rule', id: 'aaaaaaaa', payload: {} },
      { kind: 'addToSet', type: 'collection', id: 'col0000a', path: 'items', itemId: 'aaaaaaaa', item: {} },
    ]);
    const update = batchOf('rule:bbbbbbbb (update)', [
      { kind: 'setField', type: 'rule', id: 'bbbbbbbb', path: 'name', value: 'Delay probes (vim)' },
    ]);
    const other = 'rules/delay-probes-bbbbbbbb/rule.yaml';
    const returns = setAsideDeletedReturns({
      batches: [create, update],
      files: [
        { path: RULE_FILE, content: RULE_TEXT },
        { path: other, content: 'schemaVersion: 5\nuid: bbbbbbbb\nname: Delay probes\n' },
      ],
      changedPaths: new Set([RULE_FILE, other]),
      environments: [],
      isDeleted: (type, id) => type === 'rule' && id === 'aaaaaaaa',
    });
    expect(returns.batches).toEqual([update]);
    expect(returns.issues).toEqual([{ path: RULE_FILE, message: DELETED_RETURN_MESSAGE }]);
    expect(returns.holds(RULE_FILE)).toBe(true);
    expect(returns.holds('rules/block-probes-aaaaaaaa/notes.md')).toBe(true);
    expect(returns.holds(other)).toBe(false);
  });

  it('a deleted environment holds its own three files and no other environment’s', () => {
    const staging = { uid: 'envaaaaa', name: 'Staging' } as Environment;
    const file = 'environments/staging-envaaaaa.yaml';
    const returns = setAsideDeletedReturns({
      batches: [
        batchOf('environment:envaaaaa (create)', [
          { kind: 'create', type: 'environment', id: 'envaaaaa', payload: {} },
        ]),
      ],
      files: [{ path: file, content: 'schemaVersion: 5\nuid: envaaaaa\nname: Staging\n' }],
      changedPaths: new Set([file]),
      environments: [staging],
      isDeleted: (_type, id) => id === 'envaaaaa',
    });
    expect(returns.batches).toEqual([]);
    expect(returns.issues).toEqual([{ path: file, message: DELETED_RETURN_MESSAGE }]);
    expect(returns.holds(file)).toBe(true);
    expect(returns.holds('environments/staging-envaaaaa.secret.yaml')).toBe(true);
    expect(returns.holds('environments/staging-envaaaaa.secret.yaml.template')).toBe(true);
    expect(returns.holds('environments/production-envbbbbb.yaml')).toBe(false);
  });
});
