/**
 * Snippet catalog for the Scripts tab — ready-to-insert `oh.*` examples,
 * grouped per script kind. Pure data: the menu component renders it, the
 * editor inserts `code` verbatim at the cursor.
 *
 * Every snippet must stay valid against the sandbox surface in
 * `apps/extension/src/offscreen/sandbox.ts` (typed for Monaco by
 * `oh-types.ts`) — these are the examples users learn the API from.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

export interface ScriptSnippet {
  id: string;
  labelKey: MessageKey;
  code: string;
}

export interface ScriptSnippetGroup {
  labelKey: MessageKey;
  snippets: ScriptSnippet[];
}

const SEND_REQUEST: ScriptSnippet = {
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
};

const SEND_REQUEST_WITH_BODY: ScriptSnippet = {
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
};

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

const USE_PACKAGE: ScriptSnippet = {
  id: 'use-package',
  labelKey: 'workbench.editors.scriptEditor.snippet.usePackage',
  code: `const pkg = oh.require('package_name');
console.log(pkg);`,
};

const WORKFLOWS_GROUP: ScriptSnippetGroup = {
  labelKey: 'workbench.editors.scriptEditor.group.workflows',
  snippets: [SEND_REQUEST, SEND_REQUEST_WITH_BODY],
};

const PACKAGES_GROUP: ScriptSnippetGroup = {
  labelKey: 'workbench.editors.scriptEditor.group.packages',
  snippets: [USE_PACKAGE],
};

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
      },
      {
        id: 'set-method',
        labelKey: 'workbench.editors.scriptEditor.snippet.setMethod',
        code: `oh.setMethod('POST');`,
      },
      {
        id: 'set-json-body',
        labelKey: 'workbench.editors.scriptEditor.snippet.setJsonBody',
        code: `oh.setBody({
  type: 'json',
  content: JSON.stringify({ name: 'value' }),
});`,
      },
    ],
  },
  WORKFLOWS_GROUP,
  PACKAGES_GROUP,
  {
    labelKey: 'workbench.editors.scriptEditor.group.variables',
    snippets: [GET_VARIABLE, SET_VARIABLE, GET_VAULT_SECRET],
  },
];

const POST_RESPONSE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.tests',
    snippets: [
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
        code: `await oh.test('Body contains string', () => {
  oh.expect(oh.response.body).toContain('string_to_find');
});`,
      },
      {
        id: 'body-equals',
        labelKey: 'workbench.editors.scriptEditor.snippet.bodyEquals',
        code: `await oh.test('Body is the expected string', () => {
  oh.expect(oh.response.body).toBe('expected_body');
});`,
      },
      {
        id: 'json-value-check',
        labelKey: 'workbench.editors.scriptEditor.snippet.jsonValueCheck',
        code: `await oh.test('JSON value is correct', () => {
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
    ],
  },
  WORKFLOWS_GROUP,
  PACKAGES_GROUP,
  {
    labelKey: 'workbench.editors.scriptEditor.group.variables',
    snippets: [
      GET_VARIABLE,
      SET_VARIABLE,
      {
        id: 'save-response-value',
        labelKey: 'workbench.editors.scriptEditor.snippet.saveResponseValue',
        code: `const data = JSON.parse(oh.response.body);
await oh.variables.set('auth_token', data.token);`,
      },
      GET_VAULT_SECRET,
    ],
  },
];

// ── The WebSocket hooks ─────────────────────────────────────────────

const VARIABLES_GROUP: ScriptSnippetGroup = {
  labelKey: 'workbench.editors.scriptEditor.group.variables',
  snippets: [GET_VARIABLE, SET_VARIABLE, GET_VAULT_SECRET],
};

const WS_BEFORE_CONNECT_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.connect',
    snippets: [
      {
        id: 'ws-set-query-param',
        labelKey: 'workbench.editors.scriptEditor.snippet.setQueryParam',
        code: `oh.setQueryParam('token', await oh.vault.get('secret_name'));`,
      },
      {
        id: 'ws-set-header',
        labelKey: 'workbench.editors.scriptEditor.snippet.setHeader',
        code: `oh.setHeader('X-Client', 'openheaders');`,
      },
      {
        id: 'ws-set-subprotocols',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsSetSubprotocols',
        code: `oh.setSubprotocols(['graphql-transport-ws']);`,
      },
      {
        id: 'ws-set-url',
        labelKey: 'workbench.editors.scriptEditor.snippet.setUrl',
        code: `oh.setUrl('wss://ws.openheaders.com/live');`,
      },
      {
        id: 'ws-reconnect-attempt',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsReconnectAttempt',
        code: `if (oh.connect.attempt > 0) {
  oh.setQueryParam('resume', String(oh.session.lastSeen ?? ''));
}`,
      },
    ],
  },
  WORKFLOWS_GROUP,
  PACKAGES_GROUP,
  VARIABLES_GROUP,
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
        id: 'ws-drop-message',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsDropMessage',
        code: `if (oh.message.text.trim() === '') {
  oh.drop();
}`,
      },
      {
        id: 'ws-set-event',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsSetEvent',
        code: `oh.setEvent('message:v2');`,
      },
    ],
  },
  WORKFLOWS_GROUP,
  PACKAGES_GROUP,
  VARIABLES_GROUP,
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
        id: 'ws-count-messages',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsCountMessages',
        code: `oh.session.count = (oh.session.count ?? 0) + 1;
console.log('messages so far', oh.session.count);`,
      },
      {
        id: 'ws-emit-event',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsEmitEvent',
        code: `await oh.emit('ack', [{ index: oh.message.index }]);`,
      },
    ],
  },
  {
    labelKey: 'workbench.editors.scriptEditor.group.tests',
    snippets: [
      {
        id: 'ws-assert-json',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsAssertJson',
        code: `await oh.test('Message is JSON', () => {
  JSON.parse(oh.message.text ?? '');
});`,
      },
    ],
  },
  WORKFLOWS_GROUP,
  PACKAGES_GROUP,
  {
    labelKey: 'workbench.editors.scriptEditor.group.variables',
    snippets: [
      GET_VARIABLE,
      SET_VARIABLE,
      {
        id: 'ws-save-message-value',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsSaveMessageValue',
        code: `const data = JSON.parse(oh.message.text ?? '{}');
await oh.variables.set('last_event_id', String(data.id));`,
      },
      GET_VAULT_SECRET,
    ],
  },
];

const WS_AFTER_CLOSE_GROUPS: ScriptSnippetGroup[] = [
  {
    labelKey: 'workbench.editors.scriptEditor.group.tests',
    snippets: [
      {
        id: 'ws-closed-clean',
        labelKey: 'workbench.editors.scriptEditor.snippet.wsClosedClean',
        code: `await oh.test('Closed cleanly', () => {
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
    ],
  },
  WORKFLOWS_GROUP,
  PACKAGES_GROUP,
  VARIABLES_GROUP,
];

export function getScriptSnippetGroups(kind: ScriptKind): ScriptSnippetGroup[] {
  switch (kind) {
    case 'pre-request':
      return PRE_REQUEST_GROUPS;
    case 'ws-before-connect':
      return WS_BEFORE_CONNECT_GROUPS;
    case 'ws-before-send':
      return WS_BEFORE_SEND_GROUPS;
    case 'ws-on-message':
      return WS_ON_MESSAGE_GROUPS;
    case 'ws-after-close':
      return WS_AFTER_CLOSE_GROUPS;
    default:
      return POST_RESPONSE_GROUPS;
  }
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
