import { describe, expect, it } from 'vitest';
import { type MutatorContext, REQUEST_FOLDER_ENTITY_TYPE, setRequestFolderScripts } from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setRequestFolderScripts', () => {
  it('emits a setField per slot carrying the source', () => {
    const intent = setRequestFolderScripts(ctx(), {
      folderUid: 'rfold-tokens',
      updates: [{ path: 'postResponseScript', value: 'await oh.test("ok", oh.response.status === 200);' }],
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

  it('emits an unsetField when clearing a slot (field absent ↔ no script)', () => {
    const intent = setRequestFolderScripts(ctx(), {
      folderUid: 'rfold-tokens',
      updates: [{ path: 'preRequestScript', value: undefined }],
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
