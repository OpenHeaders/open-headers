/**
 * The tab strip's label is a live projection of the entity — a sidebar
 * rename reaches an open editor tab through `tabDisplayLabel`, not
 * through the seed `tab.label`. Pins the four sibling request editors
 * (gRPC, WebSocket, MQTT, GraphQL) beside the HTTP branch: each resolves
 * its request's current name by uid and falls back to the seed while
 * the entity is still loading.
 */

import {
  buildEmptyGraphqlRequest,
  buildEmptyGrpcRequest,
  buildEmptyMqttRequest,
  buildEmptyWebSocketRequest,
} from '@openheaders/core/utils';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { type TabDisplayLookups, tabDisplayLabel } from '@openheaders/ui/workbench/tab-display';
import type { WorkbenchTab } from '@openheaders/ui/workbench/types';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

const grpc = buildEmptyGrpcRequest({ uid: 'g1', path: 'Suite/Books', name: 'Books' });
const ws = buildEmptyWebSocketRequest({ uid: 'w1', path: 'Suite/Feed', name: 'Feed', flavor: 'raw' });
const mqtt = buildEmptyMqttRequest({ uid: 'm1', path: 'Suite/Broker', name: 'Broker' });
const graphql = buildEmptyGraphqlRequest({ uid: 'q1', path: 'Suite/Viewer', name: 'Viewer GraphQL' });

const lookups: TabDisplayLookups = {
  rules: [],
  templates: [],
  environments: [],
  requests: [],
  grpcRequests: [grpc],
  websocketRequests: [ws],
  mqttRequests: [mqtt],
  graphqlRequests: [graphql],
  localCollectionTrees: [],
  requestCollectionTrees: [],
  templateCollectionTrees: [],
  liveVariables: [],
  liveWorkflows: [],
  responseExamples: [],
  grpcResponseExamples: [],
  wsResponseExamples: [],
  mqttResponseExamples: [],
  specs: [],
};

const seed = { ruleType: '', dirty: false, label: 'Probe' };

const tabs: WorkbenchTab[] = [
  { ...seed, id: 'grpc-request-g1', mode: 'grpc-edit', grpcRequestUid: 'g1' },
  { ...seed, id: 'websocket-request-w1', mode: 'websocket-edit', websocketRequestUid: 'w1' },
  { ...seed, id: 'mqtt-request-m1', mode: 'mqtt-edit', mqttRequestUid: 'm1' },
  { ...seed, id: 'graphql-request-q1', mode: 'graphql-edit', graphqlRequestUid: 'q1' },
];

describe('tabDisplayLabel — the sibling request editors', () => {
  it("reads each request's live name by uid", () => {
    expect(tabs.map((tab) => tabDisplayLabel(tab, lookups, t))).toEqual(['Books', 'Feed', 'Broker', 'Viewer GraphQL']);
  });

  it('keeps the seed label while the entity is absent', () => {
    const empty: TabDisplayLookups = {
      ...lookups,
      grpcRequests: [],
      websocketRequests: [],
      mqttRequests: [],
      graphqlRequests: [],
    };
    for (const tab of tabs) expect(tabDisplayLabel(tab, empty, t)).toBe('Probe');
  });
});
