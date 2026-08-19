/**
 * Rule templates — prefilled rules organized into a folder tree per rule type.
 *
 * System templates mirror the user template storage model: each rule type
 * owns a tree of folders and templates (folders can nest). This lets the
 * RuleEditor render a consistent dropdown hierarchy for both the built-in
 * System Templates and user-saved User Templates.
 *
 * Each leaf template contains:
 *   - key: stable id referenced from tab state / template lookups
 *   - nameKey: display-name message key
 *   - descriptionKey: what it does (shown under the selector)
 *   - conditions: prefilled RuleCondition[]
 *   - formValues: prefilled form field values (not the action object)
 */

import type { RuleCondition } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';

export interface RuleTemplate {
  key: string;
  icon: string;
  nameKey: MessageKey;
  descriptionKey: MessageKey;
  conditions: RuleCondition[];
  /** Form field values to set (not the action object — these are form fields). */
  formValues: Record<string, unknown>;
}

// ── System template tree ────────────────────────────────────────
//
// A folder has a stable key + display-name message key + children
// (folders or templates). A template node wraps a RuleTemplate.
// `kind` is the discriminator used when rendering.

export interface SystemTemplateFolder {
  kind: 'folder';
  /** Stable id — menu/tree keys derive from this, never from the
   *  (localized) display name. */
  key: string;
  nameKey: MessageKey;
  children: SystemTemplateNode[];
}

export interface SystemTemplateLeaf {
  kind: 'template';
  template: RuleTemplate;
}

export type SystemTemplateNode = SystemTemplateFolder | SystemTemplateLeaf;

/** Convenience constructor — less visual noise in the tree below. */
const t = (template: RuleTemplate): SystemTemplateLeaf => ({ kind: 'template', template });
const f = (key: string, nameKey: MessageKey, children: SystemTemplateNode[]): SystemTemplateFolder => ({
  kind: 'folder',
  key,
  nameKey,
  children,
});

// ── Header templates ────────────────────────────────────────────

const HEADER_TREE: SystemTemplateNode[] = [
  f('cors-security', 'shared.ruleTemplates.folder.corsSecurity', [
    t({
      key: 'cors-bypass',
      icon: '🔓',
      nameKey: 'shared.ruleTemplates.corsBypass.name',
      descriptionKey: 'shared.ruleTemplates.corsBypass.description',
      conditions: [{ uid: 'sct00001', type: 'request-domains', values: ['openheaders.com'] }],
      formValues: {
        requestHeaders: [],
        responseHeaders: [
          { uid: 'shm00001', operation: 'override', headerName: 'Access-Control-Allow-Origin', value: '*' },
          {
            uid: 'shm00002',
            operation: 'override',
            headerName: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          { uid: 'shm00003', operation: 'override', headerName: 'Access-Control-Allow-Headers', value: '*' },
          { uid: 'shm00004', operation: 'override', headerName: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    }),
    t({
      key: 'remove-csp',
      icon: '⚡',
      nameKey: 'shared.ruleTemplates.removeCsp.name',
      descriptionKey: 'shared.ruleTemplates.removeCsp.description',
      conditions: [{ uid: 'sct00002', type: 'request-domains', values: ['openheaders.com'] }],
      formValues: {
        requestHeaders: [],
        responseHeaders: [
          { uid: 'shm00005', operation: 'remove', headerName: 'Content-Security-Policy' },
          { uid: 'shm00006', operation: 'remove', headerName: 'Content-Security-Policy-Report-Only' },
        ],
      },
    }),
    t({
      key: 'allow-embedding',
      icon: '🖼️',
      nameKey: 'shared.ruleTemplates.allowEmbedding.name',
      descriptionKey: 'shared.ruleTemplates.allowEmbedding.description',
      conditions: [{ uid: 'sct00003', type: 'resource-types', values: ['page'] }],
      formValues: {
        requestHeaders: [],
        responseHeaders: [
          { uid: 'shm00007', operation: 'remove', headerName: 'X-Frame-Options' },
          { uid: 'shm00008', operation: 'override', headerName: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
    }),
  ]),
  f('authentication', 'shared.ruleTemplates.folder.authentication', [
    t({
      key: 'api-auth',
      icon: '🔑',
      nameKey: 'shared.ruleTemplates.apiAuth.name',
      descriptionKey: 'shared.ruleTemplates.apiAuth.description',
      conditions: [{ uid: 'sct00004', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        requestHeaders: [
          { uid: 'shm00009', operation: 'override', headerName: 'Authorization', value: 'Bearer YOUR_TOKEN' },
          { uid: 'shm00010', operation: 'override', headerName: 'X-API-Key', value: 'YOUR_KEY' },
        ],
        responseHeaders: [],
      },
    }),
  ]),
  f('privacy', 'shared.ruleTemplates.folder.privacy', [
    t({
      key: 'custom-ua',
      icon: '🕵️',
      nameKey: 'shared.ruleTemplates.customUa.name',
      descriptionKey: 'shared.ruleTemplates.customUa.description',
      conditions: [{ uid: 'sct00005', type: 'request-domains', values: ['openheaders.com'] }],
      formValues: {
        requestHeaders: [
          {
            uid: 'shm00011',
            operation: 'override',
            headerName: 'User-Agent',
            value: 'Mozilla/5.0 (compatible; CustomBot/1.0)',
          },
        ],
        responseHeaders: [],
      },
    }),
    t({
      key: 'block-cookies',
      icon: '🍪',
      nameKey: 'shared.ruleTemplates.blockCookies.name',
      descriptionKey: 'shared.ruleTemplates.blockCookies.description',
      conditions: [{ uid: 'sct00006', type: 'request-domains', values: ['openheaders.com'] }],
      formValues: {
        requestHeaders: [{ uid: 'shm00012', operation: 'remove', headerName: 'Cookie' }],
        responseHeaders: [{ uid: 'shm00013', operation: 'remove', headerName: 'Set-Cookie' }],
      },
    }),
  ]),
  f('testing', 'shared.ruleTemplates.folder.testing', [
    t({
      key: 'test-merge',
      icon: '🧪',
      nameKey: 'shared.ruleTemplates.testMerge.name',
      descriptionKey: 'shared.ruleTemplates.testMerge.description',
      conditions: [{ uid: 'sct00007', type: 'request-domains', values: ['httpbin.org'] }],
      formValues: {
        requestHeaders: [],
        responseHeaders: [
          {
            uid: 'shm00014',
            operation: 'merge',
            headerName: 'Content-Type',
            value: 'x-openheaders-merged',
            mergeSeparator: ', ',
          },
        ],
      },
    }),
  ]),
];

// ── Block templates ─────────────────────────────────────────────

const BLOCK_TREE: SystemTemplateNode[] = [
  f('privacy', 'shared.ruleTemplates.folder.privacy', [
    t({
      key: 'block-trackers',
      icon: '🛡️',
      nameKey: 'shared.ruleTemplates.blockTrackers.name',
      descriptionKey: 'shared.ruleTemplates.blockTrackers.description',
      conditions: [
        { uid: 'sct00008', type: 'request-domains', values: ['google-analytics.com', 'googletagmanager.com'] },
        { uid: 'sct00009', type: 'resource-types', values: ['script', 'xhr'] },
      ],
      formValues: {},
    }),
    t({
      key: 'block-ads',
      icon: '🚫',
      nameKey: 'shared.ruleTemplates.blockAds.name',
      descriptionKey: 'shared.ruleTemplates.blockAds.description',
      conditions: [
        {
          uid: 'sct00010',
          type: 'request-domains',
          values: ['doubleclick.net', 'googlesyndication.com', 'adservice.google.com'],
        },
      ],
      formValues: {},
    }),
  ]),
];

// ── Redirect templates ──────────────────────────────────────────

const REDIRECT_TREE: SystemTemplateNode[] = [
  f('url-handling', 'shared.ruleTemplates.folder.urlHandling', [
    t({
      key: 'redirect-domain',
      icon: '↪️',
      nameKey: 'shared.ruleTemplates.redirectDomain.name',
      descriptionKey: 'shared.ruleTemplates.redirectDomain.description',
      conditions: [{ uid: 'sct00011', type: 'url-filter', values: ['*://old.openheaders.com/*'] }],
      formValues: { redirectTo: 'https://new.openheaders.com/' },
    }),
    t({
      key: 'force-https',
      icon: '🔒',
      nameKey: 'shared.ruleTemplates.forceHttps.name',
      descriptionKey: 'shared.ruleTemplates.forceHttps.description',
      conditions: [{ uid: 'sct00012', type: 'url-regex', values: ['^http://(openheaders\\.io/.*)$'] }],
      formValues: { redirectTo: 'https://\\1' },
    }),
  ]),
];

// ── Query Param templates ───────────────────────────────────────

const QUERY_PARAM_TREE: SystemTemplateNode[] = [
  f('tracking', 'shared.ruleTemplates.folder.tracking', [
    t({
      key: 'remove-utm',
      icon: '🧹',
      nameKey: 'shared.ruleTemplates.removeUtm.name',
      descriptionKey: 'shared.ruleTemplates.removeUtm.description',
      conditions: [{ uid: 'sct00013', type: 'request-domains', values: ['openheaders.com'] }],
      formValues: {
        queryParams: [
          { param: 'utm_source', value: '', operation: 'remove' },
          { param: 'utm_medium', value: '', operation: 'remove' },
          { param: 'utm_campaign', value: '', operation: 'remove' },
          { param: 'utm_content', value: '', operation: 'remove' },
          { param: 'utm_term', value: '', operation: 'remove' },
        ],
      },
    }),
  ]),
  f('debugging', 'shared.ruleTemplates.folder.debugging', [
    t({
      key: 'add-debug',
      icon: '🐛',
      nameKey: 'shared.ruleTemplates.addDebug.name',
      descriptionKey: 'shared.ruleTemplates.addDebug.description',
      conditions: [{ uid: 'sct00014', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: { queryParams: [{ param: 'debug', value: 'true', operation: 'add' }] },
    }),
  ]),
];

// ── Inject templates ────────────────────────────────────────────

const INJECT_TREE: SystemTemplateNode[] = [
  f('appearance', 'shared.ruleTemplates.folder.appearance', [
    t({
      key: 'dark-mode',
      icon: '🌙',
      nameKey: 'shared.ruleTemplates.darkMode.name',
      descriptionKey: 'shared.ruleTemplates.darkMode.description',
      conditions: [{ uid: 'sct00015', type: 'request-domains', values: ['openheaders.com'] }],
      formValues: {
        injectType: 'css',
        injectSource: 'code',
        injectCode:
          'html { filter: invert(1) hue-rotate(180deg); }\nimg, video { filter: invert(1) hue-rotate(180deg); }',
      },
    }),
  ]),
  f('debugging', 'shared.ruleTemplates.folder.debugging', [
    t({
      key: 'console-logger',
      icon: '📋',
      nameKey: 'shared.ruleTemplates.consoleLogger.name',
      descriptionKey: 'shared.ruleTemplates.consoleLogger.description',
      conditions: [{ uid: 'sct00016', type: 'request-domains', values: ['openheaders.com'] }],
      formValues: {
        injectType: 'script',
        injectSource: 'code',
        injectPosition: 'head',
        injectCode:
          'console.log("[Open Headers] Script injected — monitoring fetch requests");\nconst origFetch = window.fetch;\nwindow.fetch = function(...args) {\n  console.log("[OH] fetch:", args[0]);\n  return origFetch.apply(this, args);\n};',
      },
    }),
  ]),
];

// ── Delay templates ─────────────────────────────────────────────

const DELAY_TREE: SystemTemplateNode[] = [
  f('testing', 'shared.ruleTemplates.folder.testing', [
    t({
      key: 'slow-api',
      icon: '🐢',
      nameKey: 'shared.ruleTemplates.slowApi.name',
      descriptionKey: 'shared.ruleTemplates.slowApi.description',
      conditions: [{ uid: 'sct00017', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: { delayMs: 2000 },
    }),
    t({
      key: 'timeout-test',
      icon: '⏱️',
      nameKey: 'shared.ruleTemplates.timeoutTest.name',
      descriptionKey: 'shared.ruleTemplates.timeoutTest.description',
      conditions: [{ uid: 'sct00018', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: { delayMs: 5000 },
    }),
  ]),
];

// ── Request-body templates ──────────────────────────────────────

const REQUEST_BODY_TREE: SystemTemplateNode[] = [
  f('rest', 'shared.ruleTemplates.folder.rest', [
    t({
      key: 'rest-body-override',
      icon: '📝',
      nameKey: 'shared.ruleTemplates.restBodyOverride.name',
      descriptionKey: 'shared.ruleTemplates.restBodyOverride.description',
      conditions: [{ uid: 'sct00019', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        requestResourceType: 'rest',
        requestBodyType: 'static',
        requestStaticBody: '{\n  "name": "Test User",\n  "email": "user@openheaders.com"\n}',
      },
    }),
  ]),
  f('graphql', 'shared.ruleTemplates.folder.graphql', [
    t({
      key: 'graphql-override',
      icon: '🔮',
      nameKey: 'shared.ruleTemplates.graphqlOverride.name',
      descriptionKey: 'shared.ruleTemplates.graphqlOverride.description',
      conditions: [{ uid: 'sct00020', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        requestResourceType: 'graphql',
        requestBodyType: 'static',
        requestStaticBody:
          '{\n  "query": "query GetUser($id: ID!) { user(id: $id) { name email } }",\n  "operationName": "GetUser",\n  "variables": { "id": "1" }\n}',
        requestGraphqlKey: 'operationName',
        requestGraphqlOperator: 'Equals',
        requestGraphqlValue: 'GetUser',
      },
    }),
  ]),
];

// ── Response (Modify Response) templates ─────────────────────────

const RESPONSE_TREE: SystemTemplateNode[] = [
  f('status-codes', 'shared.ruleTemplates.folder.statusCodes', [
    t({
      key: 'mock-200',
      icon: '✅',
      nameKey: 'shared.ruleTemplates.mock200.name',
      descriptionKey: 'shared.ruleTemplates.mock200.description',
      conditions: [{ uid: 'sct00021', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        responseSource: 'mock',
        responseResourceType: 'rest',
        responseStatusCode: 200,
        responseBodyType: 'static',
        responseStaticBody: '{\n  "status": "ok",\n  "data": []\n}',
      },
    }),
    t({
      key: 'mock-404',
      icon: '❌',
      nameKey: 'shared.ruleTemplates.mock404.name',
      descriptionKey: 'shared.ruleTemplates.mock404.description',
      conditions: [{ uid: 'sct00022', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        responseSource: 'mock',
        responseResourceType: 'rest',
        responseStatusCode: 404,
        responseBodyType: 'static',
        responseStaticBody: '{\n  "error": "Not Found"\n}',
      },
    }),
    t({
      key: 'mock-500',
      icon: '💥',
      nameKey: 'shared.ruleTemplates.mock500.name',
      descriptionKey: 'shared.ruleTemplates.mock500.description',
      conditions: [{ uid: 'sct00023', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        responseSource: 'mock',
        responseResourceType: 'rest',
        responseStatusCode: 500,
        responseBodyType: 'static',
        responseStaticBody: '{\n  "error": "Internal Server Error"\n}',
      },
    }),
  ]),
  f('graphql', 'shared.ruleTemplates.folder.graphql', [
    t({
      key: 'mock-graphql',
      icon: '🔮',
      nameKey: 'shared.ruleTemplates.mockGraphql.name',
      descriptionKey: 'shared.ruleTemplates.mockGraphql.description',
      conditions: [{ uid: 'sct00024', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        responseSource: 'mock',
        responseResourceType: 'graphql',
        responseStatusCode: 200,
        responseBodyType: 'static',
        responseStaticBody:
          '{\n  "data": {\n    "user": {\n      "id": "1",\n      "name": "Test User",\n      "email": "user@openheaders.com"\n    }\n  }\n}',
        responseGraphqlKey: 'operationName',
        responseGraphqlOperator: 'Equals',
        responseGraphqlValue: 'GetUser',
      },
    }),
  ]),
  f('dynamic', 'shared.ruleTemplates.folder.dynamic', [
    t({
      key: 'mock-dynamic',
      icon: '⚙️',
      nameKey: 'shared.ruleTemplates.mockDynamic.name',
      descriptionKey: 'shared.ruleTemplates.mockDynamic.description',
      conditions: [{ uid: 'sct00025', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        responseSource: 'network',
        responseResourceType: 'rest',
        responseStatusCode: 0,
        responseBodyType: 'dynamic',
        responseDynamicBody: `function modifyResponse(args) {
  const { method, url, response, responseJSON } = args;
  if (!responseJSON) return response;

  // Inject fields
  responseJSON.debugTimestamp = Date.now();
  responseJSON.debugUrl = url;

  // Replace field values
  if (responseJSON.user) {
    responseJSON.user.email = "redacted@openheaders.com";
    responseJSON.user.role = "admin"; // escalate for testing
  }

  // Remove sensitive fields
  delete responseJSON.token;
  delete responseJSON.refreshToken;
  delete responseJSON.internalId;

  // Transform arrays — add test entries, filter, or cap length
  if (Array.isArray(responseJSON.data)) {
    responseJSON.data.unshift({ id: 0, name: "[Injected] Test Item" });
    responseJSON.data = responseJSON.data.slice(0, 5); // cap at 5 items
  }

  // Conditionally modify based on request method
  if (method === "POST") {
    responseJSON.created = true;
    responseJSON.message = "Intercepted by Open Headers";
  }

  return JSON.stringify(responseJSON);
}`,
      },
    }),
    t({
      key: 'mock-dynamic-graphql',
      icon: '⚙️',
      nameKey: 'shared.ruleTemplates.mockDynamicGraphql.name',
      descriptionKey: 'shared.ruleTemplates.mockDynamicGraphql.description',
      conditions: [{ uid: 'sct00026', type: 'request-domains', values: ['api.openheaders.com'] }],
      formValues: {
        responseSource: 'network',
        responseResourceType: 'graphql',
        responseStatusCode: 0,
        responseBodyType: 'dynamic',
        responseGraphqlKey: 'operationName',
        responseGraphqlOperator: 'Equals',
        responseGraphqlValue: 'GetUser',
        responseDynamicBody: `function modifyResponse(args) {
  const { method, url, response, responseJSON, requestData } = args;
  if (!responseJSON?.data) return response;

  // Inject mock fields into the GraphQL response
  if (responseJSON.data.user) {
    responseJSON.data.user.isTestAccount = true;
    responseJSON.data.user.featureFlags = ["dark_mode", "beta_dashboard"];
  }

  // Simulate partial errors alongside valid data
  responseJSON.errors = [
    {
      message: "[Injected] Simulated field-level error",
      path: ["user", "avatar"],
      extensions: { code: "MOCK_ERROR" }
    }
  ];

  // Add debug extensions
  responseJSON.extensions = {
    ...(responseJSON.extensions || {}),
    interceptedBy: "Open Headers",
    timestamp: Date.now()
  };

  return JSON.stringify(responseJSON);
}`,
      },
    }),
  ]),
];

// ── Tree + flat lookup by rule type ─────────────────────────────

/** Source of truth: folder tree of system templates per rule type. */
export const SYSTEM_TEMPLATE_TREE_BY_TYPE: Record<string, SystemTemplateNode[]> = {
  header: HEADER_TREE,
  block: BLOCK_TREE,
  redirect: REDIRECT_TREE,
  'query-param': QUERY_PARAM_TREE,
  inject: INJECT_TREE,
  delay: DELAY_TREE,
  'request-body': REQUEST_BODY_TREE,
  response: RESPONSE_TREE,
};

/** Walk a system template tree and return a flat list of all templates. */
export function flattenSystemTemplates(nodes: SystemTemplateNode[]): RuleTemplate[] {
  const out: RuleTemplate[] = [];
  for (const node of nodes) {
    if (node.kind === 'folder') {
      out.push(...flattenSystemTemplates(node.children));
    } else {
      out.push(node.template);
    }
  }
  return out;
}

/** Flat lookup — preserved for callers that look up templates by key. */
export const TEMPLATES_BY_TYPE: Record<string, RuleTemplate[]> = Object.fromEntries(
  Object.entries(SYSTEM_TEMPLATE_TREE_BY_TYPE).map(([type, tree]) => [type, flattenSystemTemplates(tree)]),
);
