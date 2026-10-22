// @vitest-environment jsdom
/**
 * The session-kind editors' unresolved plane — the shared per-group
 * resolver hook over a core scan's groups, the MQTT tab map over it,
 * and the Variable Scope panel's reading of a session tab: the kind
 * classifies as a request and the context resolver finds the entity
 * the tab names.
 */

import { collectMqttTemplateGroups } from '@openheaders/core/live';
import { buildEmptyMqttRequest } from '@openheaders/core/utils';
import { mqttUnresolvedSections } from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-section-unresolved';
import { resolveScopeContext } from '@openheaders/ui/workbench/components/panels/variables-panel/scope-context';
import { getScopeKind } from '@openheaders/ui/workbench/components/panels/variables-panel/scope-kind';
import { useUnresolvedTemplateGroups } from '@openheaders/ui/workbench/components/shared/unresolved-template-groups';
import type { WorkbenchTab } from '@openheaders/ui/workbench/types';
// Side-effect import — the resolver's inputs read workbench settings
// via `useSyncExternalStore`; the schema barrel registers defaults.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});

const mqttRequest = {
  ...buildEmptyMqttRequest({ uid: 'mqttreq01', path: 'requests/telemetry', name: 'Telemetry' }),
  url: 'mqtt://broker.openheaders.io:1883/{{env.NO_SUCH_VARIABLE_FOR_THIS_TEST}}',
  topic: 'sensors/room/temp',
  payload: '{"id": "{{env.NO_SUCH_PAYLOAD_VARIABLE_FOR_THIS_TEST}}"}',
};

describe('useUnresolvedTemplateGroups — the MQTT editor over the core scan', () => {
  it('flags exactly the groups whose refs fail and aggregates the lifecycle flag', () => {
    const groups = collectMqttTemplateGroups(mqttRequest);
    const { result } = renderHook(() => useUnresolvedTemplateGroups(groups, undefined));
    expect([...result.current.unresolvedGroups].sort()).toEqual(['message', 'url']);
    expect(result.current.hasUnresolvedRefs).toBe(true);
    const sections = mqttUnresolvedSections(result.current.unresolvedGroups);
    expect(sections.message).toBe(true);
    expect(sections.topics).toBe(false);
    expect(sections.auth).toBe(false);
  });

  it('reads clean when every ref is literal', () => {
    const groups = collectMqttTemplateGroups({ ...mqttRequest, url: 'mqtt://broker.openheaders.io', payload: '{}' });
    const { result } = renderHook(() => useUnresolvedTemplateGroups(groups, undefined));
    expect(result.current.unresolvedGroups.size).toBe(0);
    expect(result.current.hasUnresolvedRefs).toBe(false);
  });
});

describe('the Variable Scope panel on a session tab', () => {
  const tab: WorkbenchTab = {
    id: 'tab-mqtt',
    label: 'Telemetry',
    ruleType: 'MQTT',
    dirty: false,
    mode: 'mqtt-edit',
    mqttRequestUid: 'mqttreq01',
  };

  it('classifies the four session modes as a request', () => {
    expect(getScopeKind(tab)).toBe('request');
    expect(getScopeKind({ ...tab, mode: 'websocket-edit' })).toBe('request');
    expect(getScopeKind({ ...tab, mode: 'grpc-edit' })).toBe('request');
    expect(getScopeKind({ ...tab, mode: 'graphql-edit' })).toBe('request');
  });

  it('resolves the entity the tab names, by its kind', () => {
    const context = resolveScopeContext({
      activeTab: tab,
      scopeKind: 'request',
      rules: [],
      requests: [],
      grpcRequests: [],
      websocketRequests: [],
      mqttRequests: [mqttRequest],
      graphqlRequests: [],
      templates: [],
      families: { ruleCollections: [], requestCollections: [], templateCollections: [] },
      localCollectionTrees: [],
      requestCollectionTrees: [],
      templateCollectionTrees: [],
    });
    expect(context.entity).toEqual({ kind: 'mqtt-request', entity: mqttRequest });
  });
});
