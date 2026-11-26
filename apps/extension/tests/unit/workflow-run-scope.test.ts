/**
 * The page's scopes for a workflow run that lives in the page (the
 * workflow runs plan, Laws — "The run lives with its session"): a run
 * resolves under ITS environment, not the page's active one, and reads
 * its captures by reference.
 */

import type { Environment, MqttRequest } from '@openheaders/core/types';
import type { ResolutionError } from '@openheaders/core/variables';
import type { RendererResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import {
  getWorkflowRunScope,
  makeWorkflowRunScope,
  publishWorkflowRunScope,
  type WorkflowRunScopeInputs,
} from '@openheaders/ui/workbench/components/live/workflow-run-scope';
import type { ExecutionPlaceFacts } from '@openheaders/ui/workbench/execution-place/execution-place-facts';
import { describe, expect, it } from 'vitest';

function environment(uid: string, device: string): Environment {
  return {
    schemaVersion: 5,
    uid,
    name: uid,
    variables: [{ uid: `var${uid}`, name: 'DEVICE', value: device, type: 'default' }],
  };
}

const resolver: RendererResolverInputs = {
  vault: { schemaVersion: 5, secrets: [] },
  environments: [environment('envprod1', 'dev-9'), environment('envstage', 'dev-1')],
  activeEnvironmentId: 'envprod1',
  defaultEnvironmentId: null,
  workspaceVariables: { schemaVersion: 5, variables: [] },
  collections: { ruleCollections: [], requestCollections: [], templateCollections: [] },
  files: [],
  liveRegistry: new Map(),
};

const probe: MqttRequest = {
  schemaVersion: 5,
  uid: 'mqttprob',
  path: 'requests/devices-coldevc1/probe-mqtt-mqttprob',
  name: 'Probe MQTT',
  url: 'ws://127.0.0.1:3000/net/mqtt',
  topic: '',
  payload: '',
  topics: [],
  savedMessages: [],
  userProperties: [],
};

/** A workbench page of the extension with nothing beside it: no desktop app, no server. */
const alone: ExecutionPlaceFacts = {
  markers: {
    requestRuntime: 'browser',
    remoteRequestDispatch: null,
    wsPageSession: true,
    mqttPageSession: true,
    delegatedRequestDispatch: true,
    delegatedSessionDispatch: true,
    delegatedGrpcDispatch: true,
  },
  desktopApp: 'not-installed',
  desktopAppLaunchable: false,
  desktopAppBackendId: null,
  server: null,
  serverAllowed: true,
};

const withServer: ExecutionPlaceFacts = {
  ...alone,
  server: { backendId: 'backend-team', name: 'Team server', connected: true },
};

function makeScope(places: Partial<WorkflowRunScopeInputs['places']> = {}) {
  return makeWorkflowRunScope({
    workspaceId: 'ws-devices',
    resolver,
    ancestry: { collectionTrees: [], collections: [], folders: [] },
    workflows: [],
    mqttRequests: [probe],
    packages: [],
    places: { facts: alone, placeOf: () => undefined, global: 'auto', ...places },
  });
}

describe('a run’s scopes in the page', () => {
  it('resolves a template outside a request under the run’s environment, with a capture made later', () => {
    const stepCaptures = new Map<string, Map<string, string>>();
    const resolve = makeScope().templates({ environmentId: 'envstage', stepCaptures });
    stepCaptures.set('reboot', new Map([['commandId', 'cmd-7']]));

    expect(resolve('devices/{{env.DEVICE}}/status/{{step.reboot.commandId}}')).toEqual({
      result: 'devices/dev-1/status/cmd-7',
      errors: [],
    });
  });

  it('names a reference nothing answers', () => {
    const resolve = makeScope().templates({ environmentId: null, stepCaptures: new Map() });

    const resolved = resolve('{{env.DEVICE}}');

    expect(resolved.errors.map((error) => error.reference)).toEqual(['env.DEVICE']);
  });

  it('gives a session the run opens the same environment and captures', async () => {
    const stepCaptures = new Map<string, Map<string, string>>();
    const session = await makeScope().mqttSession(probe, { environmentId: 'envstage', stepCaptures });
    stepCaptures.set('reboot', new Map([['commandId', 'cmd-7']]));
    const unresolved = new Map<string, ResolutionError>();

    expect(session.resolve('devices/{{env.DEVICE}}/name/{{step.reboot.commandId}}', unresolved)).toBe(
      'devices/dev-1/name/cmd-7',
    );
    expect(unresolved.size).toBe(0);
  });

  it('is read from the one slot the shell publishes to, and gone with it', () => {
    const scope = makeScope();
    publishWorkflowRunScope(scope);
    expect(getWorkflowRunScope()).toBe(scope);
    publishWorkflowRunScope(null);
    expect(getWorkflowRunScope()).toBeNull();
  });
});

describe('where a run’s session opens', () => {
  const tcp: MqttRequest = { ...probe, uid: 'mqtttcp1', url: 'mqtt://broker.openheaders.io:1883' };

  it('is here for a WebSocket broker, and nowhere for a raw TCP one with no place connected', () => {
    const scope = makeScope();

    expect(scope.mqttPlace(probe)).toMatchObject({ place: 'here', state: 'ready', target: null });
    expect(scope.mqttPlace(tcp)).toMatchObject({
      place: 'desktop-app',
      state: 'needs-companion',
      reason: { kind: 'tcp-scheme' },
      target: null,
    });
  });

  it('is the workspace’s connected server for a raw TCP broker, named by its backend', () => {
    expect(makeScope({ facts: withServer }).mqttPlace(tcp)).toMatchObject({
      place: 'workspace-server',
      state: 'ready',
      reason: { kind: 'delegated', role: 'workspace-server' },
      target: { backendId: 'backend-team' },
    });
  });

  it('follows the request’s own saved place over the global row, as its editor does', () => {
    const scope = makeScope({
      facts: withServer,
      placeOf: (uid) => (uid === 'mqttprob' ? 'workspace-server' : undefined),
      global: 'desktop-app',
    });

    expect(scope.mqttPlace(probe)).toMatchObject({ place: 'workspace-server', target: { backendId: 'backend-team' } });
    // No saved place of its own: the global row asks for a desktop app that is not there.
    expect(scope.mqttPlace({ ...probe, uid: 'mqttelse' })).toMatchObject({
      state: 'unsupported',
      reason: { kind: 'preference-unavailable', preferred: 'desktop-app' },
      target: null,
    });
  });
});
