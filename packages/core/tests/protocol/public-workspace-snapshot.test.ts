import { describe, expect, it } from 'vitest';

import {
  buildPublicWorkspaceSnapshot,
  parsePublicWorkspacePath,
  publicWorkspacePagePath,
  publicWorkspaceSnapshotPath,
  SNAPSHOT_SCHEMA_VERSION,
  summarizePublicWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '../../src/protocol';
import type { Variable } from '../../src/types';

function makeSnapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    workspaceId: 'ws-1',
    takenAtHlc: { sw: { physicalMs: 100, logical: 0, nodeId: 'sw' } },
    rules: [],
    environments: [],
    collections: [],
    workspaceVariables: [],
    vault: [],
    trustedRoots: [],
    workspaceRoots: [],
    folders: [],
    requests: [],
    requestCollections: [],
    requestFolders: [],
    grpcRequests: [],
    websocketRequests: [],
    mqttRequests: [],
    responseExamples: [],
    grpcResponseExamples: [],
    wsResponseExamples: [],
    mqttResponseExamples: [],
    scriptPackages: [],
    specs: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    liveVariables: [],
    liveWorkflows: [],
    liveValues: [],
    liveFallbackPriority: [],
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
    ...overrides,
  };
}

function makeVariable(overrides: Partial<Variable> = {}): Variable {
  return { uid: 'var-1', name: 'API_HOST', value: 'api.openheaders.io', type: 'default', ...overrides };
}

describe('public workspace path vocabulary', () => {
  it('round-trips page and snapshot paths', () => {
    expect(publicWorkspacePagePath('ws-1')).toBe('/public/ws-1');
    expect(publicWorkspaceSnapshotPath('ws-1')).toBe('/public/ws-1/snapshot.json');
    expect(parsePublicWorkspacePath('/public/ws-1')).toEqual({ workspaceId: 'ws-1', kind: 'page' });
    expect(parsePublicWorkspacePath('/public/ws-1/snapshot.json')).toEqual({ workspaceId: 'ws-1', kind: 'snapshot' });
  });

  it('decodes encoded ids', () => {
    const id = 'ws one';
    expect(parsePublicWorkspacePath(publicWorkspacePagePath(id))).toEqual({ workspaceId: id, kind: 'page' });
  });

  it('refuses paths outside the prefix and malformed ones inside it', () => {
    expect(parsePublicWorkspacePath('/pair/ws-1')).toBeNull();
    expect(parsePublicWorkspacePath('/public/')).toBeNull();
    expect(parsePublicWorkspacePath('/public/ws-1/other.json')).toBeNull();
    expect(parsePublicWorkspacePath('/public/ws-1/a/b')).toBeNull();
    expect(parsePublicWorkspacePath('/public/%zz')).toBeNull();
  });
});

describe('buildPublicWorkspaceSnapshot', () => {
  const secretVar = makeVariable({ uid: 'var-2', name: 'API_TOKEN', value: 'oh-secret', type: 'secret' });

  function richSnapshot(): WorkspaceSnapshot {
    return makeSnapshot({
      // Shape-irrelevant fixtures: the projection empties these arrays
      // whole, so only their non-emptiness matters to the assertions.
      vault: [{ secret: 'oh-secret' }] as unknown as WorkspaceSnapshot['vault'],
      oauthBundles: [{ token: 'oh-token' }] as unknown as WorkspaceSnapshot['oauthBundles'],
      liveValues: [{ value: 'live' }] as unknown as WorkspaceSnapshot['liveValues'],
      pauseMarkers: [{ marker: true }] as unknown as WorkspaceSnapshot['pauseMarkers'],
      layoutState: [{ layout: {} }] as unknown as WorkspaceSnapshot['layoutState'],
      liveFallbackPriority: [{ member: 'a' }] as unknown as WorkspaceSnapshot['liveFallbackPriority'],
      workspaceVariables: [
        {
          workspaceVariables: { schemaVersion: 5, variables: [makeVariable(), secretVar] },
          varUids: ['var-1', 'var-2'],
          setOrderKeys: {},
        },
      ],
      environments: [
        {
          environment: { schemaVersion: 5, uid: 'env-1', name: 'prod', variables: [secretVar] },
          varUids: ['var-2'],
          setOrderKeys: {},
        },
      ],
      requestCollections: [
        {
          collection: {
            schemaVersion: 5,
            uid: 'col-1',
            path: 'api',
            name: 'API',
            variables: [secretVar],
            pinnedEnvironmentIds: [],
            defaultEnvironmentId: null,
          },
          varUids: ['var-2'],
          setOrderKeys: {},
        },
      ],
      collections: [
        {
          collection: {
            schemaVersion: 5,
            uid: 'col-2',
            path: 'rules',
            name: 'Rules',
            variables: [makeVariable()],
            pinnedEnvironmentIds: [],
            defaultEnvironmentId: null,
          },
          varUids: ['var-1'],
          setOrderKeys: {},
        },
      ],
      requests: [{ request: { uid: 'req-1' } }, { request: { uid: 'req-2' } }] as WorkspaceSnapshot['requests'],
    });
  }

  it('empties the sensitive set and drops runtime state', () => {
    const { snapshot } = buildPublicWorkspaceSnapshot(richSnapshot());
    expect(snapshot.vault).toEqual([]);
    expect(snapshot.oauthBundles).toEqual([]);
    expect(snapshot.liveValues).toEqual([]);
    expect(snapshot.pauseMarkers).toEqual([]);
    expect(snapshot.layoutState).toEqual([]);
    expect(snapshot.liveFallbackPriority).toEqual([]);
  });

  it('strips secret-typed variable values in every scope, keeping names', () => {
    const result = buildPublicWorkspaceSnapshot(richSnapshot());
    expect(result.secretValuesStripped).toBe(3);
    const wsVars = result.snapshot.workspaceVariables[0].workspaceVariables.variables;
    expect(wsVars.find((entry) => entry.name === 'API_TOKEN')?.value).toBe('');
    expect(wsVars.find((entry) => entry.name === 'API_HOST')?.value).toBe('api.openheaders.io');
    expect(result.snapshot.environments[0].environment.variables[0]).toMatchObject({ name: 'API_TOKEN', value: '' });
    expect(result.snapshot.requestCollections[0].collection.variables[0]).toMatchObject({
      name: 'API_TOKEN',
      value: '',
    });
    // Non-secret collection variables ride verbatim.
    expect(result.snapshot.collections[0].collection.variables[0].value).toBe('api.openheaders.io');
  });

  it('does not mutate the input', () => {
    const input = richSnapshot();
    buildPublicWorkspaceSnapshot(input);
    expect(input.vault).toHaveLength(1);
    expect(input.workspaceVariables[0].workspaceVariables.variables[1].value).toBe('oh-secret');
    expect(input.pauseMarkers).toHaveLength(1);
  });

  it('summarizes from the projection — secret rows are name-only, counts skip empty arrays', () => {
    const result = buildPublicWorkspaceSnapshot(richSnapshot());
    const summary = summarizePublicWorkspaceSnapshot(result);
    expect(summary.secretValuesStripped).toBe(3);
    expect(summary.entityCounts).toEqual({
      collections: 1,
      environments: 1,
      requestCollections: 1,
      requests: 2,
    });
    const secretRows = summary.variables.filter((row) => row.secret);
    expect(secretRows).toHaveLength(3);
    for (const row of secretRows) expect(row.value).toBe('');
    expect(summary.variables.find((row) => row.scope === 'environment')?.container).toBe('prod');
    expect(summary.variables.find((row) => row.scope === 'workspace' && !row.secret)?.value).toBe('api.openheaders.io');
  });
});
