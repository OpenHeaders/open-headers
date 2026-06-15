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
 *   - name: display name
 *   - description: what it does (shown under the selector)
 *   - conditions: prefilled RuleCondition[]
 *   - formValues: prefilled form field values (not the action object)
 */

import type { RuleCondition } from '@openheaders/core/types';
export interface RuleTemplate {
  key: string;
  icon: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  /** Form field values to set (not the action object — these are form fields). */
  formValues: Record<string, unknown>;
}

// ── System template tree ────────────────────────────────────────
//
// A folder has a name + children (folders or templates). A template node
// wraps a RuleTemplate. `kind` is the discriminator used when rendering.

export interface SystemTemplateFolder {
  kind: 'folder';
  name: string;
  children: SystemTemplateNode[];
}

export interface SystemTemplateLeaf {
  kind: 'template';
  template: RuleTemplate;
}

export type SystemTemplateNode = SystemTemplateFolder | SystemTemplateLeaf;

/** Convenience constructor — less visual noise in the tree below. */
const t = (template: RuleTemplate): SystemTemplateLeaf => ({ kind: 'template', template });
const f = (name: string, children: SystemTemplateNode[]): SystemTemplateFolder => ({
  kind: 'folder',
  name,
  children,
});

// ── Header templates ────────────────────────────────────────────

const HEADER_TREE: SystemTemplateNode[] = [
  f('CORS & Security', [
    t({
      key: 'cors-bypass',
      icon: '🔓',
      name: 'CORS Bypass',
      description: 'Remove restrictive CORS headers to allow cross-origin requests during development',
      conditions: [{ uid: 'sct00001', type: 'request-domains', values: ['openheaders.io'] }],
      formValues: {
        requestHeaders: [],
        responseHeaders: [
          { uid: 'shm00001', operation: 'override', headerName: 'Access-Control-Allow-Origin', value: '*' },
          {
            uid: 'shm00002', operation: 'override',
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
      name: 'Remove CSP',
      description: 'Strip Content-Security-Policy headers for development',
      conditions: [{ uid: 'sct00002', type: 'request-domains', values: ['openheaders.io'] }],
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
      name: 'Allow Embedding',
      description: 'Remove X-Frame-Options to allow iframing',
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
  f('Authentication', [
    t({
      key: 'api-auth',
      icon: '🔑',
      name: 'API Auth Injection',
      description: 'Auto-inject Authorization header into API calls',
      conditions: [{ uid: 'sct00004', type: 'request-domains', values: ['api.openheaders.io'] }],
      formValues: {
        requestHeaders: [
          { uid: 'shm00009', operation: 'override', headerName: 'Authorization', value: 'Bearer YOUR_TOKEN' },
          { uid: 'shm00010', operation: 'override', headerName: 'X-API-Key', value: 'YOUR_KEY' },
        ],
        responseHeaders: [],
      },
    }),
  ]),
  f('Privacy', [
    t({
      key: 'custom-ua',
      icon: '🕵️',
      name: 'Custom User-Agent',
      description: 'Override the User-Agent header for specific domains',
      conditions: [{ uid: 'sct00005', type: 'request-domains', values: ['openheaders.io'] }],
      formValues: {
        requestHeaders: [
          { uid: 'shm00011', operation: 'override', headerName: 'User-Agent', value: 'Mozilla/5.0 (compatible; CustomBot/1.0)' },
        ],
        responseHeaders: [],
      },
    }),
    t({
      key: 'block-cookies',
      icon: '🍪',
      name: 'Block Cookies',
      description: 'Remove Cookie header from outgoing requests',
      conditions: [{ uid: 'sct00006', type: 'request-domains', values: ['openheaders.io'] }],
      formValues: {
        requestHeaders: [{ uid: 'shm00012', operation: 'remove', headerName: 'Cookie' }],
        responseHeaders: [{ uid: 'shm00013', operation: 'remove', headerName: 'Set-Cookie' }],
      },
    }),
  ]),
  f('Testing', [
    t({
      key: 'test-merge',
      icon: '🧪',
      name: 'Test Merge (httpbin)',
      description:
        'Test the Merge operation by appending to a response header.\n1. Enable this rule\n2. Open httpbin.org in a new tab\n3. Run in console: fetch("https://httpbin.org/get").then(r=>{console.log("Content-Type:",r.headers.get("Content-Type"))})\n4. Content-Type should show "application/json, x-openheaders-merged"',
      conditions: [{ uid: 'sct00007', type: 'request-domains', values: ['httpbin.org'] }],
      formValues: {
        requestHeaders: [],
        responseHeaders: [
          { uid: 'shm00014', operation: 'merge', headerName: 'Content-Type', value: 'x-openheaders-merged', mergeSeparator: ', ' },
        ],
      },
    }),
  ]),
];

// ── Block templates ─────────────────────────────────────────────

const BLOCK_TREE: SystemTemplateNode[] = [
  f('Privacy', [
    t({
      key: 'block-trackers',
      icon: '🛡️',
      name: 'Block Trackers',
      description: 'Block analytics and tracking scripts',
      conditions: [
        { uid: 'sct00008', type: 'request-domains', values: ['google-analytics.com', 'googletagmanager.com'] },
        { uid: 'sct00009', type: 'resource-types', values: ['script', 'xhr'] },
      ],
      formValues: {},
    }),
    t({
      key: 'block-ads',
      icon: '🚫',
      name: 'Block Ads',
      description: 'Block common ad network domains',
      conditions: [
        { uid: 'sct00010', type: 'request-domains', values: ['doubleclick.net', 'googlesyndication.com', 'adservice.google.com'] },
      ],
      formValues: {},
    }),
  ]),
];

// ── Redirect templates ──────────────────────────────────────────

const REDIRECT_TREE: SystemTemplateNode[] = [
  f('URL Handling', [
    t({
      key: 'redirect-domain',
      icon: '↪️',
      name: 'Redirect Domain',
      description: 'Redirect all traffic from one domain to another',
      conditions: [{ uid: 'sct00011', type: 'url-filter', values: ['*://old.openheaders.io/*'] }],
      formValues: { redirectTo: 'https://new.openheaders.io/' },
    }),
    t({
      key: 'force-https',
      icon: '🔒',
      name: 'Force HTTPS',
      description: 'Upgrade HTTP to HTTPS — uses regex capture group to preserve the full path',
      conditions: [{ uid: 'sct00012', type: 'url-regex', values: ['^http://(openheaders\\.io/.*)$'] }],
      formValues: { redirectTo: 'https://\\1' },
    }),
  ]),
];

// ── Query Param templates ───────────────────────────────────────

const QUERY_PARAM_TREE: SystemTemplateNode[] = [
  f('Tracking', [
    t({
      key: 'remove-utm',
      icon: '🧹',
      name: 'Remove UTM Params',
      description: 'Strip UTM tracking parameters from URLs',
      conditions: [{ uid: 'sct00013', type: 'request-domains', values: ['openheaders.io'] }],
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
  f('Debugging', [
    t({
      key: 'add-debug',
      icon: '🐛',
      name: 'Add Debug Flag',
      description: 'Add a debug=true query parameter to API calls',
      conditions: [{ uid: 'sct00014', type: 'request-domains', values: ['api.openheaders.io'] }],
      formValues: { queryParams: [{ param: 'debug', value: 'true', operation: 'add' }] },
    }),
  ]),
];

// ── Inject templates ────────────────────────────────────────────

const INJECT_TREE: SystemTemplateNode[] = [
  f('Appearance', [
    t({
      key: 'dark-mode',
      icon: '🌙',
      name: 'Dark Mode CSS',
      description: 'Inject a basic dark mode stylesheet',
      conditions: [{ uid: 'sct00015', type: 'request-domains', values: ['openheaders.io'] }],
      formValues: {
        injectType: 'css',
        injectSource: 'code',
        injectCode:
          'html { filter: invert(1) hue-rotate(180deg); }\nimg, video { filter: invert(1) hue-rotate(180deg); }',
      },
    }),
  ]),
  f('Debugging', [
    t({
      key: 'console-logger',
      icon: '📋',
      name: 'Console Logger',
      description: 'Log all fetch requests to the console',
      conditions: [{ uid: 'sct00016', type: 'request-domains', values: ['openheaders.io'] }],
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
  f('Testing', [
    t({
      key: 'slow-api',
      icon: '🐢',
      name: 'Slow API (2s)',
      description: 'Add 2 second delay to API calls — test loading states',
      conditions: [{ uid: 'sct00017', type: 'request-domains', values: ['api.openheaders.io'] }],
      formValues: { delayMs: 2000 },
    }),
    t({
      key: 'timeout-test',
      icon: '⏱️',
      name: 'Timeout Test (5s)',
      description: 'Add 5 second delay — test timeout handling',
      conditions: [{ uid: 'sct00018', type: 'request-domains', values: ['api.openheaders.io'] }],
      formValues: { delayMs: 5000 },
    }),
  ]),
];

// ── Request-body templates ──────────────────────────────────────

const REQUEST_BODY_TREE: SystemTemplateNode[] = [
  f('REST', [
    t({
      key: 'rest-body-override',
      icon: '📝',
      name: 'REST Body Override',
      description: 'Replace the request body with a static JSON payload',
      conditions: [{ uid: 'sct00019', type: 'request-domains', values: ['api.openheaders.io'] }],
      formValues: {
        requestResourceType: 'rest',
        requestBodyType: 'static',
        requestStaticBody: '{\n  "name": "Test User",\n  "email": "user@openheaders.io"\n}',
      },
    }),
  ]),
  f('GraphQL', [
    t({
      key: 'graphql-override',
      icon: '🔮',
      name: 'GraphQL Override',
      description: 'Override a GraphQL request body with a custom query and variables',
      conditions: [{ uid: 'sct00020', type: 'request-domains', values: ['api.openheaders.io'] }],
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
  f('Status Codes', [
    t({
      key: 'mock-200',
      icon: '✅',
      name: 'Mock 200 JSON',
      description: 'Return a successful JSON response for a REST API endpoint',
      conditions: [{ uid: 'sct00021', type: 'request-domains', values: ['api.openheaders.io'] }],
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
      name: 'Mock 404',
      description: 'Return a 404 Not Found response',
      conditions: [{ uid: 'sct00022', type: 'request-domains', values: ['api.openheaders.io'] }],
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
      name: 'Mock Server Error',
      description: 'Return a 500 Internal Server Error — test error handling',
      conditions: [{ uid: 'sct00023', type: 'request-domains', values: ['api.openheaders.io'] }],
      formValues: {
        responseSource: 'mock',
        responseResourceType: 'rest',
        responseStatusCode: 500,
        responseBodyType: 'static',
        responseStaticBody: '{\n  "error": "Internal Server Error"\n}',
      },
    }),
  ]),
  f('GraphQL', [
    t({
      key: 'mock-graphql',
      icon: '🔮',
      name: 'Mock GraphQL Response',
      description: 'Return a custom response for a specific GraphQL operation',
      conditions: [{ uid: 'sct00024', type: 'request-domains', values: ['api.openheaders.io'] }],
      formValues: {
        responseSource: 'mock',
        responseResourceType: 'graphql',
        responseStatusCode: 200,
        responseBodyType: 'static',
        responseStaticBody:
          '{\n  "data": {\n    "user": {\n      "id": "1",\n      "name": "Test User",\n      "email": "user@openheaders.io"\n    }\n  }\n}',
        responseGraphqlKey: 'operationName',
        responseGraphqlOperator: 'Equals',
        responseGraphqlValue: 'GetUser',
      },
    }),
  ]),
  f('Dynamic', [
    t({
      key: 'mock-dynamic',
      icon: '⚙️',
      name: 'Dynamic REST Response',
      description:
        'Intercept the real REST API response and modify it with JavaScript — inject test data, remove fields, or transform the response shape',
      conditions: [{ uid: 'sct00025', type: 'request-domains', values: ['api.openheaders.io'] }],
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
    responseJSON.user.email = "redacted@openheaders.io";
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
      name: 'Dynamic GraphQL Response',
      description:
        'Intercept a specific GraphQL operation response and modify it with JavaScript — reshape data, inject mock fields, or simulate errors',
      conditions: [{ uid: 'sct00026', type: 'request-domains', values: ['api.openheaders.io'] }],
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
