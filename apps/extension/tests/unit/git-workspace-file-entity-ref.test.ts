/**
 * A named file tree's row as Jump to Source opens it: the entity the
 * workbench holds, by uid, through the registered tab openers — a
 * request with its method, a collection or folder with the tree its
 * section lists, the workspace's variables as the one page.
 */

import type { WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import type { WorkspaceFileEntity } from '@openheaders/ui/shared/workspace-files';
import {
  type GitEntityOpeners,
  jumpToEntity,
  registerGitEntityOpeners,
} from '@openheaders/ui/workbench/components/panels/git/git-entity-opener';
import { workspaceFileEntityRef } from '@openheaders/ui/workbench/components/panels/git/workspace-file-entity-ref';
import { describe, expect, it, vi } from 'vitest';

const REQUEST: WorkspaceFileEntity = {
  kind: 'node',
  node: { type: 'request', uid: 'req00003', name: 'Create Order', path: 'requests/orders-col00001/x', method: 'POST' },
};

function openers(): GitEntityOpeners {
  return {
    openEditTab: vi.fn(),
    openRequestEditTab: vi.fn(),
    openGrpcRequestEditTab: vi.fn(),
    openWebSocketRequestEditTab: vi.fn(),
    openMqttRequestEditTab: vi.fn(),
    openGraphqlRequestEditTab: vi.fn(),
    openTemplateEditTab: vi.fn(),
    openSpecEdit: vi.fn(),
    openLiveWorkflowEdit: vi.fn(),
    openLiveVariables: vi.fn(),
    openEnvironmentEdit: vi.fn(),
    openWorkspaceVariables: vi.fn(),
    openVault: vi.fn(),
    openCollectionOverview: vi.fn(),
    openRequestCollectionOverview: vi.fn(),
    openTemplateCollectionOverview: vi.fn(),
    openFolderOverview: vi.fn(),
    openRequestFolderOverview: vi.fn(),
    openTemplateFolderOverview: vi.fn(),
  };
}

describe('workspaceFileEntityRef', () => {
  it('a request is its uid, name and method; the other leaves their own kind', () => {
    expect(workspaceFileEntityRef('requests', REQUEST)).toEqual({
      kind: 'request',
      tree: null,
      uid: 'req00003',
      name: 'Create Order',
      method: 'POST',
    });
    const kindOf = (node: Extract<WorkspaceFileEntity, { kind: 'node' }>['node']): string =>
      workspaceFileEntityRef('requests', { kind: 'node', node }).kind;
    const at = { uid: 'u0000001', name: 'n', path: 'p' };
    expect(kindOf({ type: 'graphql-request', ...at })).toBe('graphql');
    expect(kindOf({ type: 'grpc-request', ...at })).toBe('grpc');
    expect(kindOf({ type: 'websocket-request', ...at, flavor: 'raw' })).toBe('websocket');
    expect(kindOf({ type: 'mqtt-request', ...at })).toBe('mqtt');
  });

  it('a collection or a folder names the tree its section lists', () => {
    expect(workspaceFileEntityRef('rules', { kind: 'collection', uid: 'col00001', name: 'Orders' })).toEqual({
      kind: 'collection',
      tree: 'rules',
      uid: 'col00001',
      name: 'Orders',
    });
    expect(workspaceFileEntityRef('templates', { kind: 'folder', uid: 'fol00001', name: 'Auth' }).tree).toBe(
      'templates',
    );
  });

  it('a spec, a workflow, a live variable and an environment go by uid; the workspace’s variables are the one page', () => {
    for (const kind of ['spec', 'workflow', 'live-variable', 'environment'] as const) {
      expect(workspaceFileEntityRef('files', { kind, uid: 'ent00001', name: 'Staging' })).toEqual({
        kind,
        tree: null,
        uid: 'ent00001',
        name: 'Staging',
      });
    }
    expect(workspaceFileEntityRef('workspace-variables', { kind: 'workspace-variables' })).toEqual({
      kind: 'workspace-variables',
      tree: null,
      uid: '',
      name: '',
    });
  });
});

describe('jumpToEntity', () => {
  it('opens nothing while no host has offered its openers', () => {
    expect(jumpToEntity(workspaceFileEntityRef('requests', REQUEST))).toBe('no-editor');
  });

  it('opens the entity’s editor by uid through the registered openers', () => {
    const registered = openers();
    const withdraw = registerGitEntityOpeners(() => registered);
    try {
      expect(jumpToEntity(workspaceFileEntityRef('requests', REQUEST))).toBe('opened');
      expect(registered.openRequestEditTab).toHaveBeenCalledWith('req00003', 'Create Order', 'POST');
      const collection: WorkspaceTreeEntityRefWire = workspaceFileEntityRef('requests', {
        kind: 'collection',
        uid: 'col00001',
        name: 'Orders',
      });
      expect(jumpToEntity(collection)).toBe('opened');
      expect(registered.openRequestCollectionOverview).toHaveBeenCalledWith('col00001', 'Orders');
      expect(jumpToEntity({ ...collection, tree: null })).toBe('no-editor');
    } finally {
      withdraw();
    }
  });
});
