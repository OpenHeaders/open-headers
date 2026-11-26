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
} from '@openheaders/ui/workbench/components/live/workflow-run-scope';
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

function makeScope() {
  return makeWorkflowRunScope({
    workspaceId: 'ws-devices',
    resolver,
    ancestry: { collectionTrees: [], collections: [], folders: [] },
    workflows: [],
    mqttRequests: [probe],
    packages: [],
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
