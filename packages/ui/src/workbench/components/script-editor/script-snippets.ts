/**
 * Snippet catalog for the Scripts tab — ready-to-insert `oh.*` examples
 * per script kind. Pure data: the menu component renders it, the editor
 * inserts `code` verbatim at the cursor.
 *
 * Three laws shape every list:
 * - The hook's OWN group leads, named for what the hook acts on
 *   (Request · Response · Connect · Send · Message · Close · Publish ·
 *   Invoke): one snippet per verb the hook's `oh` declares, plus one
 *   that reads the hook's view. A snippet only ever calls what its
 *   kind's ambient declaration (`oh-types.ts`) offers — the catalog
 *   test pins that against the DTS.
 * - One shared tail in one order: Tests (the after / on hooks alone),
 *   Variables (get · set · the hook's "save a value" · vault),
 *   Requests (the two ad-hoc sends). No Packages group — the Packages
 *   menu beside this one inserts the real requires.
 * - A test snippet's label IS its test name, verbatim — the menu and
 *   the Tests view say the same sentence.
 *
 * A snippet marked `requestOnly` replaces a request's identity (its
 * URL, method, body, gRPC message); a container's slot runs for every
 * request it holds, so those entries stay off the container mount.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { ScriptSlotScope } from './script-slots';

export interface ScriptSnippet {
  id: string;
  labelKey: MessageKey;
  code: string;
  /** Rewrites what the request IS — shown on the request mount alone. */
  requestOnly?: true;
}

export interface ScriptSnippetGroup {
  labelKey: MessageKey;
  snippets: ScriptSnippet[];
}

// ── The shared tail ─────────────────────────────────────────────────

const GET_VARIABLE: ScriptSnippet = {
  id: 'get-variable',
  labelKey: 'workbench.editors.scriptEditor.snippet.getVariable',
  code: `const value = await oh.variables.get('variable_name');
console.log(value);`,
};

const SET_VARIABLE: ScriptSnippet = {
  id: 'set-variable',
  labelKey: 'workbench.editors.scriptEditor.snippet.setVariable',
  code: `await oh.variables.set('variable_name', 'variable_value');`,
};

const GET_VAULT_SECRET: ScriptSnippet = {
  id: 'get-vault-secret',
  labelKey: 'workbench.editors.scriptEditor.snippet.getVaultSecret',
  code: `const secret = await oh.vault.get('secret_name');`,
};

/** The Variables group; a hook's "save a value" snippet slots in
 *  between the setter and the vault read. */
function variablesGroup(save?: ScriptSnippet): ScriptSnippetGroup {
  return {
    labelKey: 'workbench.editors.scriptEditor.group.variables',
    snippets: save
      ? [GET_VARIABLE, SET_VARIABLE, save, GET_VAULT_SECRET]
      : [GET_VARIABLE, SET_VARIABLE, GET_VAULT_SECRET],
  };
}

const REQUESTS_GROUP: ScriptSnippetGroup = {
  labelKey: 'workbench.editors.scriptEditor.group.requests',
  snippets: [
    {
      id: 'send-request',
      labelKey: 'workbench.editors.scriptEditor.snippet.sendRequest',
      code: `try {
  const response = await oh.sendRequest({
    url: 'https://api.openheaders.com/v1/items',
    method: 'GET',
  });
  console.log(response.status, response.body);
} catch (err) {
  console.error(err);
}`,
    },
    {
      id: 'send-request-with-body',
      labelKey: 'workbench.editors.scriptEditor.snippet.sendRequestJsonBody',
      code: `try {
  const response = await oh.sendRequest({
    url: 'https://api.openheaders.com/v1/items',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: { type: 'json', content: JSON.stringify({ name: 'value' }) },
  });
  console.log(response.status, response.body);
} catch (err) {
  console.error(err);
}`,
    },
  ],
};

function testsGroup(snippets: ScriptSnippet[]): ScriptSnippetGroup {
  return { labelKey: 'workbench.editors.scriptEditor.group.tests', snippets };
}

// ── HTTP ────────────────────────────────────────────────────────────

const PRE_REQUEST_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.request',
    snippets: [
      {
        id: 'set-header',
        labelKey: 'workbench.editors.scriptEditor.snippet.setHeader',
        code: `oh.setHeader('X-Api-Key', 'value');`,
      },
      {
        id: 'remove-header',
        labelKey: 'workbench.editors.scriptEditor.snippet.removeHeader',
        code: `oh.removeHeader('X-Api-Key');`,
      },
      {
        id: 'set-query-param',
        labelKey: 'workbench.editors.scriptEditor.snippet.setQueryParam',
        code: `oh.setQueryParam('page', '1');`,
      },
      {
        id: 'remove-query-param',
        labelKey: 'workbench.editors.scriptEditor.snippet.removeQueryParam',
        code: `oh.removeQueryParam('page');`,
      },
      {
        id: 'set-url',
        labelKey: 'workbench.editors.scriptEditor.snippet.setUrl',
        code: `oh.setUrl('https://api.openheaders.com/v1/items');`,
        requestOnly: true,
      },
      {
        id: 'set-method',
        labelKey: 'workbench.editors.scriptEditor.snippet.setMethod',
        code: `oh.setMethod('POST');`,
        requestOnly: true,
      },
      {
        id: 'set-json-body',
        labelKey: 'workbench.editors.scriptEditor.snippet.setJsonBody',
        code: `oh.setBody({
  type: 'json',
  content: JSON.stringify({ name: 'value' }),
});`,
        requestOnly: true,
      },
      {
        id: 'log-request',
        labelKey: 'workbench.editors.scriptEditor.snippet.logRequest',
        code: `console.log(oh.request.method, oh.request.url, oh.request.headers.length + ' headers');`,
      },
    ],
  },
  variablesGroup(),
  REQUESTS_GROUP,
];

const POST_RESPONSE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.response',
    snippets: [
      {
        id: 'parse-json-body',
        labelKey: 'workbench.editors.scriptEditor.snippet.parseJsonBody',
        code: `const data = JSON.parse(oh.response.body);
console.log(data);`,
      },
      {
        id: 'find-response-header',
        labelKey: 'workbench.editors.scriptEditor.snippet.findResponseHeader',
        code: `const header = oh.response.headers.find((h) => h.key.toLowerCase() === 'content-type');
console.log(header?.value);`,
      },
      {
        id: 'log-response',
        labelKey: 'workbench.editors.scriptEditor.snippet.logResponse',
        code: `console.log(oh.response.status, oh.response.statusText, oh.response.durationMs + ' ms');`,
      },
    ],
  },
  testsGroup([
    {
      id: 'status-code-200',
      labelKey: 'workbench.editors.scriptEditor.snippet.statusCode200',
      code: `await oh.test('Status code is 200', () => {
  oh.expect(oh.response).toHaveStatus(200);
});`,
    },
    {
      id: 'body-contains',
      labelKey: 'workbench.editors.scriptEditor.snippet.bodyContains',
      code: `await oh.test('Response body contains a string', () => {
  oh.expect(oh.response.body).toContain('string_to_find');
});`,
    },
    {
      id: 'body-equals',
      labelKey: 'workbench.editors.scriptEditor.snippet.bodyEquals',
      code: `await oh.test('Response body equals a string', () => {
  oh.expect(oh.response.body).toBe('expected_body');
});`,
    },
    {
      id: 'json-value-check',
      labelKey: 'workbench.editors.scriptEditor.snippet.jsonValueCheck',
      code: `await oh.test('Response body JSON value is correct', () => {
  const data = JSON.parse(oh.response.body);
  oh.expect(data.name).toBe('value');
});`,
    },
    {
      id: 'header-check',
      labelKey: 'workbench.editors.scriptEditor.snippet.headerCheck',
      code: `await oh.test('Content-Type header is present', () => {
  const header = oh.response.headers.find((h) => h.key.toLowerCase() === 'content-type');
  oh.expect(header?.value).toContain('application/json');
});`,
    },
    {
      id: 'response-time',
      labelKey: 'workbench.editors.scriptEditor.snippet.responseTime',
      code: `await oh.test('Response time is below 200 ms', () => {
  oh.expect(oh.response.durationMs < 200).toBeTruthy();
});`,
    },
  ]),
  variablesGroup({
    id: 'save-response-value',
    labelKey: 'workbench.editors.scriptEditor.snippet.saveResponseValue',
    code: `const data = JSON.parse(oh.response.body);
await oh.variables.set('auth_token', data.token);`,
  }),
  REQUESTS_GROUP,
];

// ── WebSocket ───────────────────────────────────────────────────────

const WS_BEFORE_CONNECT_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.connect',
    snippets: [
      {
        id: 'ws-set-header',
        labelKey: 'workbench.editors.scriptEditor.snippet.setHeader',
        code: `oh.setHeader('X-Client', 'openheaders');`,
      },
      {
        id: 'ws-remove-header',
        labelKey: 'workbench.editors.scriptEditor.snippet.removeHeader',
        code: `oh.removeHeader('X-Client');`,
      },
      {
        id: 'ws-set-query-param',
        labelKey: 'workbench.editors.scriptEditor.snippet.setQueryParam',
        code: `oh.setQueryParam('token', await oh.vault.get('secret_name'));`,
      },
      {
        id: 'ws-remove-query-param',
        labelKey: 'workbench.editors.scriptEditor.snippet.removeQueryParam',
        code: `oh.removeQueryParam('token');`,
      },
      {
        id: 'ws-set-url',
        labelKey: 'workbench.editors.scriptEditor.snippet.setUrl',
        code: `oh.setUrl('wss://ws.openheaders.com/live');`,
        requestOnly: true,
      },
      {
        id: 'ws-set-subprotocols',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsSetSubprotocols',
        code: `oh.setSubprotocols(['graphql-transport-ws']);`,
      },
      {
        id: 'ws-reconnect-attempt',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsReconnectAttempt',
        code: `if (oh.connect.attempt > 0) {
  oh.setQueryParam('resume', String(oh.session.lastSeen ?? ''));
}`,
      },
      {
        id: 'ws-log-dial',
        labelKey: 'workbench.editors.scriptEditor.snippet.logDial',
        code: `console.log(oh.connect.url, 'attempt', oh.connect.attempt, oh.connect.subprotocols);`,
      },
    ],
  },
  variablesGroup(),
  REQUESTS_GROUP,
];

const WS_BEFORE_SEND_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.send',
    snippets: [
      {
        id: 'ws-set-message',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsSetMessage',
        code: `const payload = JSON.parse(oh.message.text);
payload.sentAt = Date.now();
oh.setMessage(JSON.stringify(payload));`,
      },
      {
        id: 'ws-set-event',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsSetEvent',
        code: `oh.setEvent('message:v2');`,
      },
      {
        id: 'ws-drop-message',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsDropMessage',
        code: `if (oh.message.text.trim() === '') {
  oh.drop();
}`,
      },
      {
        id: 'ws-log-outbound',
        labelKey: 'workbench.editors.scriptEditor.snippet.logOutgoingMessage',
        code: `console.log('#' + oh.message.index, oh.message.eventName ?? 'message', oh.message.text);`,
      },
    ],
  },
  variablesGroup(),
  REQUESTS_GROUP,
];

const WS_ON_MESSAGE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.message',
    snippets: [
      {
        id: 'ws-reply',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsReply',
        code: `if (oh.message.text === 'ping') {
  await oh.send('pong');
}`,
      },
      {
        id: 'ws-reply-binary',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsReplyBinary',
        code: `if (oh.message.binary) {
  await oh.sendBinary(oh.message.dataBase64);
}`,
      },
      {
        id: 'ws-emit-event',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsEmitEvent',
        code: `await oh.emit('ack', [{ index: oh.message.index }]);`,
      },
      {
        id: 'ws-count-messages',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsCountMessages',
        code: `oh.session.count = (oh.session.count ?? 0) + 1;
console.log('messages so far', oh.session.count);`,
      },
      {
        id: 'ws-log-message',
        labelKey: 'workbench.editors.scriptEditor.snippet.logMessage',
        code: `console.log('#' + oh.message.index, oh.message.binary ? oh.message.dataBase64 : oh.message.text);`,
      },
    ],
  },
  testsGroup([
    {
      id: 'ws-assert-json',
      labelKey: 'workbench.editors.scriptEditor.snippet.wsAssertJson',
      code: `await oh.test('Message is JSON', () => {
  JSON.parse(oh.message.text ?? '');
});`,
    },
  ]),
  variablesGroup({
    id: 'ws-save-message-value',
    labelKey: 'workbench.editors.scriptEditor.snippet.wsSaveMessageValue',
    code: `const data = JSON.parse(oh.message.text ?? '{}');
await oh.variables.set('last_event_id', String(data.id));`,
  }),
  REQUESTS_GROUP,
];

const WS_AFTER_CLOSE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.close',
    snippets: [
      {
        id: 'ws-log-close',
        labelKey: 'workbench.editors.scriptEditor.snippet.logClose',
        code: `console.log(oh.close.code, oh.close.reason, oh.close.messages + ' messages', oh.close.durationMs + ' ms');`,
      },
    ],
  },
  testsGroup([
    {
      id: 'ws-closed-clean',
      labelKey: 'workbench.editors.scriptEditor.snippet.wsClosedClean',
      code: `await oh.test('Session closed cleanly', () => {
  oh.expect(oh.close.code).toBe(1000);
});`,
    },
    {
      id: 'ws-message-count',
      labelKey: 'workbench.editors.scriptEditor.snippet.wsMessageCount',
      code: `await oh.test('Messages arrived', () => {
  oh.expect(oh.close.messages > 0).toBeTruthy();
});`,
    },
    {
      id: 'ws-nothing-dropped',
      labelKey: 'workbench.editors.scriptEditor.snippet.wsNothingDropped',
      code: `await oh.test('Nothing was dropped', () => {
  oh.expect(oh.close.droppedMessages).toBe(0);
});`,
    },
  ]),
  variablesGroup(),
  REQUESTS_GROUP,
];

// ── MQTT ────────────────────────────────────────────────────────────

const MQTT_BEFORE_CONNECT_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.connect',
    snippets: [
      {
        id: 'mqtt-set-client-id',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetClientId',
        code: `oh.setClientId('device-' + Date.now().toString(36));`,
      },
      {
        id: 'mqtt-set-credentials',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetCredentials',
        code: `oh.setUsername('device');
oh.setPassword(await oh.vault.get('secret_name'));`,
      },
      {
        id: 'mqtt-add-subscription',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttAddSubscription',
        code: `oh.addSubscription('devices/+/status', { qos: 1 });`,
      },
      {
        id: 'mqtt-set-will',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetWill',
        code: `oh.setWill({ topic: 'devices/status', payload: 'offline', retain: true });`,
      },
      {
        id: 'mqtt-set-user-property',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetUserProperty',
        code: `oh.setUserProperty('client', 'openheaders');`,
      },
      {
        id: 'mqtt-reconnect-attempt',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttReconnectAttempt',
        code: `if (oh.connect.attempt > 0) {
  oh.setUserProperty('resume', String(oh.session.lastSeen ?? ''));
}`,
      },
      {
        id: 'mqtt-log-dial',
        labelKey: 'workbench.editors.scriptEditor.snippet.logDial',
        code: `console.log(oh.connect.url, oh.connect.clientId, 'attempt', oh.connect.attempt, oh.connect.subscriptions.length + ' subscriptions');`,
      },
    ],
  },
  variablesGroup(),
  REQUESTS_GROUP,
];

const MQTT_BEFORE_PUBLISH_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.publish',
    snippets: [
      {
        id: 'mqtt-set-payload',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetPayload',
        code: `const payload = JSON.parse(oh.message.payload);
payload.sentAt = Date.now();
oh.setPayload(JSON.stringify(payload));`,
      },
      {
        id: 'mqtt-set-topic',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetTopic',
        code: `oh.setTopic('devices/' + (await oh.variables.get('device_id')) + '/events');`,
      },
      {
        id: 'mqtt-set-flags',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetFlags',
        code: `oh.setQos(1);
oh.setRetain(false);`,
      },
      {
        id: 'mqtt-set-response-topic',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetResponseTopic',
        code: `oh.setProperties({ ...oh.message.properties, responseTopic: 'devices/replies' });`,
      },
      {
        id: 'mqtt-set-publish-user-property',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttSetPublishUserProperty',
        code: `oh.setUserProperty('trace', Date.now().toString(36));`,
      },
      {
        id: 'mqtt-drop-message',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttDropMessage',
        code: `if (oh.message.payload.trim() === '') {
  oh.drop();
}`,
      },
      {
        id: 'mqtt-log-outbound',
        labelKey: 'workbench.editors.scriptEditor.snippet.logOutgoingMessage',
        code: `console.log('#' + oh.message.index, oh.message.topic, 'qos', oh.message.qos, oh.message.payload);`,
      },
    ],
  },
  variablesGroup(),
  REQUESTS_GROUP,
];

const MQTT_ON_MESSAGE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.message',
    snippets: [
      {
        id: 'mqtt-reply',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttReply',
        code: `const replyTo = oh.message.properties?.responseTopic;
if (replyTo) {
  await oh.publish(replyTo, 'ack', { qos: oh.message.qos });
}`,
      },
      {
        id: 'mqtt-count-messages',
        labelKey: 'workbench.editors.scriptEditor.snippet.mqttCountMessages',
        code: `oh.session.count = (oh.session.count ?? 0) + 1;
console.log(oh.message.topic, 'messages so far', oh.session.count);`,
      },
      {
        id: 'mqtt-log-message',
        labelKey: 'workbench.editors.scriptEditor.snippet.logMessage',
        code: `console.log('#' + oh.message.index, oh.message.topic, 'qos', oh.message.qos, oh.message.text ?? oh.message.payloadBase64);`,
      },
    ],
  },
  testsGroup([
    {
      id: 'mqtt-assert-json',
      labelKey: 'workbench.editors.scriptEditor.snippet.mqttAssertJson',
      code: `await oh.test('Payload is JSON', () => {
  JSON.parse(oh.message.text ?? '');
});`,
    },
  ]),
  variablesGroup({
    id: 'mqtt-save-message-value',
    labelKey: 'workbench.editors.scriptEditor.snippet.mqttSaveMessageValue',
    code: `const data = JSON.parse(oh.message.text ?? '{}');
await oh.variables.set('last_reading', String(data.value));`,
  }),
  REQUESTS_GROUP,
];

const MQTT_AFTER_CLOSE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.close',
    snippets: [
      {
        id: 'mqtt-log-close',
        labelKey: 'workbench.editors.scriptEditor.snippet.logClose',
        code: `console.log(oh.close.end?.by ?? 'severed', oh.close.published + ' published', oh.close.received + ' received', oh.close.durationMs + ' ms');`,
      },
    ],
  },
  testsGroup([
    {
      id: 'mqtt-closed-clean',
      labelKey: 'workbench.editors.scriptEditor.snippet.mqttClosedClean',
      code: `await oh.test('Disconnected cleanly', () => {
  oh.expect(oh.close.end?.by).toBe('client');
});`,
    },
    {
      id: 'mqtt-message-count',
      labelKey: 'workbench.editors.scriptEditor.snippet.mqttMessageCount',
      code: `await oh.test('Messages arrived', () => {
  oh.expect(oh.close.received > 0).toBeTruthy();
});`,
    },
    {
      id: 'mqtt-connack-accepted',
      labelKey: 'workbench.editors.scriptEditor.snippet.mqttConnackAccepted',
      code: `await oh.test('Broker accepted the session', () => {
  oh.expect(oh.close.connack?.reasonCode).toBe(0);
});`,
    },
  ]),
  variablesGroup(),
  REQUESTS_GROUP,
];

// ── gRPC ────────────────────────────────────────────────────────────

const GRPC_BEFORE_INVOKE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.invoke',
    snippets: [
      {
        id: 'grpc-set-metadata',
        labelKey: 'workbench.editors.scriptEditor.snippet.grpcSetMetadata',
        code: `oh.setMetadata('x-api-key', await oh.vault.get('secret_name'));`,
      },
      {
        id: 'grpc-remove-metadata',
        labelKey: 'workbench.editors.scriptEditor.snippet.grpcRemoveMetadata',
        code: `oh.removeMetadata('x-api-key');`,
      },
      {
        id: 'grpc-set-message',
        labelKey: 'workbench.editors.scriptEditor.snippet.grpcSetMessage',
        code: `const message = JSON.parse(oh.invoke.messageText || '{}');
message.requestedAt = new Date().toISOString();
oh.setMessage(JSON.stringify(message));`,
        requestOnly: true,
      },
      {
        id: 'grpc-log-call',
        labelKey: 'workbench.editors.scriptEditor.snippet.grpcLogCall',
        code: `console.log(oh.invoke.service + '/' + oh.invoke.method, oh.invoke.shape, oh.invoke.target);`,
      },
    ],
  },
  variablesGroup(),
  REQUESTS_GROUP,
];

const GRPC_ON_MESSAGE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.message',
    snippets: [
      {
        id: 'grpc-log-message',
        labelKey: 'workbench.editors.scriptEditor.snippet.grpcLogMessage',
        code: `console.log(oh.message.direction === 'up' ? 'sent' : 'received', oh.message.type, oh.message.value);`,
      },
      {
        id: 'grpc-count-messages',
        labelKey: 'workbench.editors.scriptEditor.snippet.grpcCountMessages',
        code: `oh.session.received = (oh.session.received ?? 0) + (oh.message.direction === 'down' ? 1 : 0);
console.log('received so far', oh.session.received);`,
      },
    ],
  },
  testsGroup([
    {
      id: 'grpc-assert-decoded',
      labelKey: 'workbench.editors.scriptEditor.snippet.grpcAssertDecoded',
      code: `await oh.test('Message decoded', () => {
  oh.expect(oh.message.value).toBeTruthy();
});`,
    },
    {
      id: 'grpc-assert-field',
      labelKey: 'workbench.editors.scriptEditor.snippet.grpcAssertField',
      code: `await oh.test('Message field is set', () => {
  oh.expect(oh.message.value?.name).toBeTruthy();
});`,
    },
  ]),
  variablesGroup({
    id: 'grpc-save-message-value',
    labelKey: 'workbench.editors.scriptEditor.snippet.grpcSaveMessageValue',
    code: `if (oh.message.direction === 'down' && oh.message.value) {
  await oh.variables.set('last_name', String(oh.message.value.name ?? ''));
}`,
  }),
  REQUESTS_GROUP,
];

const GRPC_AFTER_RESPONSE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.response',
    snippets: [
      {
        id: 'grpc-log-status',
        labelKey: 'workbench.editors.scriptEditor.snippet.grpcLogStatus',
        code: `console.log('status', oh.response.status, oh.response.statusMessage ?? '', oh.response.received + ' received', oh.response.durationMs + ' ms');`,
      },
    ],
  },
  testsGroup([
    {
      id: 'grpc-status-ok',
      labelKey: 'workbench.editors.scriptEditor.snippet.grpcStatusOk',
      code: `await oh.test('Status is OK', () => {
  oh.expect(oh.response.status).toBe(0);
});`,
    },
    {
      id: 'grpc-message-count',
      labelKey: 'workbench.editors.scriptEditor.snippet.grpcMessageCount',
      code: `await oh.test('Messages arrived', () => {
  oh.expect(oh.response.received > 0).toBeTruthy();
});`,
    },
    {
      id: 'grpc-trailer-check',
      labelKey: 'workbench.editors.scriptEditor.snippet.grpcTrailerCheck',
      code: `await oh.test('Trailer is present', () => {
  const trailer = oh.response.trailers.find((t) => t.key === 'x-request-id');
  oh.expect(trailer?.value).toBeTruthy();
});`,
    },
  ]),
  variablesGroup(),
  REQUESTS_GROUP,
];

/** The catalog, exhaustive over the slot kinds — a widened kind cannot
 *  ship without its list. */
const SCRIPT_SNIPPETS_BY_KIND: Record<ScriptKind, ScriptSnippetGroup[]> = {
  'pre-request': PRE_REQUEST_GROUPS,
  'post-response': POST_RESPONSE_GROUPS,
  'ws-before-connect': WS_BEFORE_CONNECT_GROUPS,
  'ws-before-send': WS_BEFORE_SEND_GROUPS,
  'ws-on-message': WS_ON_MESSAGE_GROUPS,
  'ws-after-close': WS_AFTER_CLOSE_GROUPS,
  'mqtt-before-connect': MQTT_BEFORE_CONNECT_GROUPS,
  'mqtt-before-publish': MQTT_BEFORE_PUBLISH_GROUPS,
  'mqtt-on-message': MQTT_ON_MESSAGE_GROUPS,
  'mqtt-after-close': MQTT_AFTER_CLOSE_GROUPS,
  'grpc-before-invoke': GRPC_BEFORE_INVOKE_GROUPS,
  'grpc-on-message': GRPC_ON_MESSAGE_GROUPS,
  'grpc-after-response': GRPC_AFTER_RESPONSE_GROUPS,
};

/** The groups for one slot on one mount — the request mount reads the
 *  whole list; the container mount drops the request-only entries. */
export function getScriptSnippetGroups(kind: ScriptKind, scope: ScriptSlotScope = 'request'): ScriptSnippetGroup[] {
  const groups = SCRIPT_SNIPPETS_BY_KIND[kind];
  if (scope === 'request') return groups;
  return groups
    .map((group) => ({ labelKey: group.labelKey, snippets: group.snippets.filter((s) => !s.requestOnly) }))
    .filter((group) => group.snippets.length > 0);
}

/** Case-insensitive label filter that preserves the group structure;
 *  groups with no surviving snippets drop out. Matches against the
 *  RESOLVED labels — what the user actually reads in the menu. */
export function filterScriptSnippetGroups(
  groups: ScriptSnippetGroup[],
  query: string,
  t: Translate,
): ScriptSnippetGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => ({
      labelKey: group.labelKey,
      snippets: group.snippets.filter((s) => t(s.labelKey).toLowerCase().includes(needle)),
    }))
    .filter((group) => group.snippets.length > 0);
}
