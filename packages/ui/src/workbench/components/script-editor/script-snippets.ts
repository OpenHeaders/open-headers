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

export interface ScriptSnippet {
  id: string;
  label: string;
  code: string;
}

export interface ScriptSnippetGroup {
  label: string;
  snippets: ScriptSnippet[];
}

const SEND_REQUEST: ScriptSnippet = {
  id: 'send-request',
  label: 'Send an HTTP request',
  code: `try {
  const response = await oh.sendRequest({
    url: 'https://api.openheaders.io/v1/items',
    method: 'GET',
  });
  console.log(response.status, response.body);
} catch (err) {
  console.error(err);
}`,
};

const SEND_REQUEST_WITH_BODY: ScriptSnippet = {
  id: 'send-request-with-body',
  label: 'Send an HTTP request with a JSON body',
  code: `try {
  const response = await oh.sendRequest({
    url: 'https://api.openheaders.io/v1/items',
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
  label: 'Get a variable',
  code: `const value = await oh.variables.get('variable_name');
console.log(value);`,
};

const SET_VARIABLE: ScriptSnippet = {
  id: 'set-variable',
  label: 'Set a variable',
  code: `await oh.variables.set('variable_name', 'variable_value');`,
};

const GET_VAULT_SECRET: ScriptSnippet = {
  id: 'get-vault-secret',
  label: 'Get a vault secret',
  code: `const secret = await oh.vault.get('secret_name');`,
};

const USE_PACKAGE: ScriptSnippet = {
  id: 'use-package',
  label: 'Use a package',
  code: `const pkg = oh.require('package_name');
console.log(pkg);`,
};

const WORKFLOWS_GROUP: ScriptSnippetGroup = {
  label: 'Workflows',
  snippets: [SEND_REQUEST, SEND_REQUEST_WITH_BODY],
};

const PACKAGES_GROUP: ScriptSnippetGroup = {
  label: 'Packages',
  snippets: [USE_PACKAGE],
};

const PRE_REQUEST_GROUPS: ScriptSnippetGroup[] = [
  {
    label: 'Request',
    snippets: [
      {
        id: 'set-header',
        label: 'Set a header',
        code: `oh.setHeader('X-Api-Key', 'value');`,
      },
      {
        id: 'remove-header',
        label: 'Remove a header',
        code: `oh.removeHeader('X-Api-Key');`,
      },
      {
        id: 'set-query-param',
        label: 'Set a query parameter',
        code: `oh.setQueryParam('page', '1');`,
      },
      {
        id: 'remove-query-param',
        label: 'Remove a query parameter',
        code: `oh.removeQueryParam('page');`,
      },
      {
        id: 'set-url',
        label: 'Set the URL',
        code: `oh.setUrl('https://api.openheaders.io/v1/items');`,
      },
      {
        id: 'set-method',
        label: 'Set the method',
        code: `oh.setMethod('POST');`,
      },
      {
        id: 'set-json-body',
        label: 'Set a JSON body',
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
    label: 'Variables',
    snippets: [GET_VARIABLE, SET_VARIABLE, GET_VAULT_SECRET],
  },
];

const POST_RESPONSE_GROUPS: ScriptSnippetGroup[] = [
  {
    label: 'Tests',
    snippets: [
      {
        id: 'status-code-200',
        label: 'Status code is 200',
        code: `await oh.test('Status code is 200', () => {
  oh.expect(oh.response).toHaveStatus(200);
});`,
      },
      {
        id: 'body-contains',
        label: 'Response body contains a string',
        code: `await oh.test('Body contains string', () => {
  oh.expect(oh.response.body).toContain('string_to_find');
});`,
      },
      {
        id: 'body-equals',
        label: 'Response body equals a string',
        code: `await oh.test('Body is the expected string', () => {
  oh.expect(oh.response.body).toBe('expected_body');
});`,
      },
      {
        id: 'json-value-check',
        label: 'Response body JSON value check',
        code: `await oh.test('JSON value is correct', () => {
  const data = JSON.parse(oh.response.body);
  oh.expect(data.name).toBe('value');
});`,
      },
      {
        id: 'header-check',
        label: 'Response header check',
        code: `await oh.test('Content-Type header is present', () => {
  const header = oh.response.headers.find((h) => h.key.toLowerCase() === 'content-type');
  oh.expect(header?.value).toContain('application/json');
});`,
      },
      {
        id: 'response-time',
        label: 'Response time is below 200 ms',
        code: `await oh.test('Response time is below 200 ms', () => {
  oh.expect(oh.response.durationMs < 200).toBeTruthy();
});`,
      },
    ],
  },
  WORKFLOWS_GROUP,
  PACKAGES_GROUP,
  {
    label: 'Variables',
    snippets: [
      GET_VARIABLE,
      SET_VARIABLE,
      {
        id: 'save-response-value',
        label: 'Save a response value to a variable',
        code: `const data = JSON.parse(oh.response.body);
await oh.variables.set('auth_token', data.token);`,
      },
      GET_VAULT_SECRET,
    ],
  },
];

export function getScriptSnippetGroups(kind: ScriptKind): ScriptSnippetGroup[] {
  return kind === 'pre-request' ? PRE_REQUEST_GROUPS : POST_RESPONSE_GROUPS;
}

/** Case-insensitive label filter that preserves the group structure;
 *  groups with no surviving snippets drop out. */
export function filterScriptSnippetGroups(groups: ScriptSnippetGroup[], query: string): ScriptSnippetGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => ({
      label: group.label,
      snippets: group.snippets.filter((s) => s.label.toLowerCase().includes(needle)),
    }))
    .filter((group) => group.snippets.length > 0);
}
