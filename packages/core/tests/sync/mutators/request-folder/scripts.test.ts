import { describe, expect, it } from 'vitest';
import { type MutatorContext, REQUEST_FOLDER_ENTITY_TYPE, setRequestFolderScript } from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setRequestFolderScript', () => {
  it('emits a setField at the script path carrying the source', () => {
    const intent = setRequestFolderScript(ctx(), {
      folderUid: 'rfold-tokens',
      path: 'postResponseScript',
      value: 'await oh.test("ok", oh.response.status === 200);',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rfold-tokens',
      path: 'postResponseScript',
      value: 'await oh.test("ok", oh.response.status === 200);',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('emits an unsetField when clearing the slot (field absent ↔ no script)', () => {
    const intent = setRequestFolderScript(ctx(), {
      folderUid: 'rfold-tokens',
      path: 'preRequestScript',
      value: undefined,
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'unsetField',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rfold-tokens',
      path: 'preRequestScript',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});
