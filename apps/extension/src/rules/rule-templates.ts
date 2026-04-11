/**
 * Rule templates — prefilled rules organized by type.
 *
 * Each template contains:
 *   - name: display name in the template selector
 *   - description: what it does (shown in hover/tooltip)
 *   - conditions: prefilled RuleCondition[]
 *   - action: prefilled action fields (form values, not V5.Rule action)
 *
 * "Empty" is always the first option (blank form, no prefill).
 */

import type { V5 } from '@openheaders/core/types';

export interface RuleTemplate {
  key: string;
  icon: string;
  name: string;
  description: string;
  conditions: V5.RuleCondition[];
  /** Form field values to set (not the V5 action object — these are form fields). */
  formValues: Record<string, unknown>;
}

// ── Header templates ────────────────────────────────────────────

export const HEADER_TEMPLATES: RuleTemplate[] = [
  {
    key: 'cors-bypass',
    icon: '🔓',
    name: 'CORS Bypass',
    description: 'Remove restrictive CORS headers to allow cross-origin requests during development',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      requestHeaders: [],
      responseHeaders: [
        { operation: 'override', headerName: 'Access-Control-Allow-Origin', value: '*' },
        { operation: 'override', headerName: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
        { operation: 'override', headerName: 'Access-Control-Allow-Headers', value: '*' },
        { operation: 'override', headerName: 'Access-Control-Allow-Credentials', value: 'true' },
      ],
    },
  },
  {
    key: 'custom-ua',
    icon: '🕵️',
    name: 'Custom User-Agent',
    description: 'Override the User-Agent header for specific domains',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      requestHeaders: [
        { operation: 'override', headerName: 'User-Agent', value: 'Mozilla/5.0 (compatible; CustomBot/1.0)' },
      ],
      responseHeaders: [],
    },
  },
  {
    key: 'api-auth',
    icon: '🔑',
    name: 'API Auth Injection',
    description: 'Auto-inject Authorization header into API calls',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      requestHeaders: [
        { operation: 'override', headerName: 'Authorization', value: 'Bearer YOUR_TOKEN' },
        { operation: 'override', headerName: 'X-API-Key', value: 'YOUR_KEY' },
      ],
      responseHeaders: [],
    },
  },
  {
    key: 'remove-csp',
    icon: '⚡',
    name: 'Remove CSP',
    description: 'Strip Content-Security-Policy headers for development',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      requestHeaders: [],
      responseHeaders: [
        { operation: 'remove', headerName: 'Content-Security-Policy' },
        { operation: 'remove', headerName: 'Content-Security-Policy-Report-Only' },
      ],
    },
  },
  {
    key: 'block-cookies',
    icon: '🍪',
    name: 'Block Cookies',
    description: 'Remove Cookie header from outgoing requests',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      requestHeaders: [{ operation: 'remove', headerName: 'Cookie' }],
      responseHeaders: [{ operation: 'remove', headerName: 'Set-Cookie' }],
    },
  },
  {
    key: 'allow-embedding',
    icon: '🖼️',
    name: 'Allow Embedding',
    description: 'Remove X-Frame-Options to allow iframing',
    conditions: [{ type: 'resource-types', values: ['page'] }],
    formValues: {
      requestHeaders: [],
      responseHeaders: [
        { operation: 'remove', headerName: 'X-Frame-Options' },
        { operation: 'override', headerName: 'Content-Security-Policy', value: 'frame-ancestors *' },
      ],
    },
  },
  {
    key: 'test-merge',
    icon: '🧪',
    name: 'Test Merge (httpbin)',
    description:
      'Test the Merge operation by appending to a response header.\n1. Enable this rule\n2. Open httpbin.org in a new tab\n3. Run in console: fetch("https://httpbin.org/get").then(r=>{console.log("Content-Type:",r.headers.get("Content-Type"))})\n4. Content-Type should show "application/json, x-openheaders-merged"',
    conditions: [{ type: 'request-domains', values: ['httpbin.org'] }],
    formValues: {
      requestHeaders: [],
      responseHeaders: [
        { operation: 'merge', headerName: 'Content-Type', value: 'x-openheaders-merged', mergeSeparator: ', ' },
      ],
    },
  },
];

// ── Block templates ────────────────────────────────────────────

export const BLOCK_TEMPLATES: RuleTemplate[] = [
  {
    key: 'block-trackers',
    icon: '🛡️',
    name: 'Block Trackers',
    description: 'Block analytics and tracking scripts',
    conditions: [
      { type: 'request-domains', values: ['google-analytics.com', 'googletagmanager.com'] },
      { type: 'resource-types', values: ['script', 'xhr'] },
    ],
    formValues: {},
  },
  {
    key: 'block-ads',
    icon: '🚫',
    name: 'Block Ads',
    description: 'Block common ad network domains',
    conditions: [
      { type: 'request-domains', values: ['doubleclick.net', 'googlesyndication.com', 'adservice.google.com'] },
    ],
    formValues: {},
  },
];

// ── Redirect templates ──────────────────────────────────────────

export const REDIRECT_TEMPLATES: RuleTemplate[] = [
  {
    key: 'redirect-domain',
    icon: '↪️',
    name: 'Redirect Domain',
    description: 'Redirect all traffic from one domain to another',
    conditions: [{ type: 'url-filter', values: ['*://old.openheaders.io/*'] }],
    formValues: { redirectTo: 'https://new.openheaders.io/' },
  },
  {
    key: 'force-https',
    icon: '🔒',
    name: 'Force HTTPS',
    description: 'Upgrade HTTP to HTTPS — uses regex capture group to preserve the full path',
    conditions: [{ type: 'url-regex', values: ['^http://(openheaders\\.io/.*)$'] }],
    formValues: { redirectTo: 'https://\\1' },
  },
];

// ── Query Param templates ───────────────────────────────────────

export const QUERY_PARAM_TEMPLATES: RuleTemplate[] = [
  {
    key: 'remove-utm',
    icon: '🧹',
    name: 'Remove UTM Params',
    description: 'Strip UTM tracking parameters from URLs',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      queryParams: [
        { param: 'utm_source', value: '', operation: 'remove' },
        { param: 'utm_medium', value: '', operation: 'remove' },
        { param: 'utm_campaign', value: '', operation: 'remove' },
        { param: 'utm_content', value: '', operation: 'remove' },
        { param: 'utm_term', value: '', operation: 'remove' },
      ],
    },
  },
  {
    key: 'add-debug',
    icon: '🐛',
    name: 'Add Debug Flag',
    description: 'Add a debug=true query parameter to API calls',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: { queryParams: [{ param: 'debug', value: 'true', operation: 'add' }] },
  },
];

// ── Inject templates ────────────────────────────────────────────

export const INJECT_TEMPLATES: RuleTemplate[] = [
  {
    key: 'dark-mode',
    icon: '🌙',
    name: 'Dark Mode CSS',
    description: 'Inject a basic dark mode stylesheet',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      injectType: 'css',
      injectSource: 'code',
      injectCode:
        'html { filter: invert(1) hue-rotate(180deg); }\nimg, video { filter: invert(1) hue-rotate(180deg); }',
    },
  },
  {
    key: 'console-logger',
    icon: '📋',
    name: 'Console Logger',
    description: 'Log all fetch requests to the console',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      injectType: 'script',
      injectSource: 'code',
      injectPosition: 'head',
      injectCode:
        'console.log("[Open Headers] Script injected — monitoring fetch requests");\nconst origFetch = window.fetch;\nwindow.fetch = function(...args) {\n  console.log("[OH] fetch:", args[0]);\n  return origFetch.apply(this, args);\n};',
    },
  },
];

// ── Delay templates ─────────────────────────────────────────────

export const DELAY_TEMPLATES: RuleTemplate[] = [
  {
    key: 'slow-api',
    icon: '🐢',
    name: 'Slow API (2s)',
    description: 'Add 2 second delay to API calls — test loading states',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: { delayMs: 2000 },
  },
  {
    key: 'timeout-test',
    icon: '⏱️',
    name: 'Timeout Test (5s)',
    description: 'Add 5 second delay — test timeout handling',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: { delayMs: 5000 },
  },
];

// ── Body templates ──────────────────────────────────────────────

export const BODY_TEMPLATES: RuleTemplate[] = [
  {
    key: 'rest-body-override',
    icon: '📝',
    name: 'REST Body Override',
    description: 'Replace the request body with a static JSON payload',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      bodyResourceType: 'rest',
      bodyModType: 'static',
      bodyStaticContent: '{\n  "name": "Test User",\n  "email": "user@openheaders.io"\n}',
    },
  },
  {
    key: 'graphql-override',
    icon: '🔮',
    name: 'GraphQL Override',
    description: 'Override a GraphQL request body with a custom query and variables',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      bodyResourceType: 'graphql',
      bodyModType: 'static',
      bodyStaticContent:
        '{\n  "query": "query GetUser($id: ID!) { user(id: $id) { name email } }",\n  "operationName": "GetUser",\n  "variables": { "id": "1" }\n}',
      bodyGraphqlKey: 'operationName',
      bodyGraphqlOperator: 'Equals',
      bodyGraphqlValue: 'GetUser',
    },
  },
];

// ── Mock / API Response templates ───────────────────────────────

export const MOCK_TEMPLATES: RuleTemplate[] = [
  {
    key: 'mock-200',
    icon: '✅',
    name: 'Mock 200 JSON',
    description: 'Return a successful JSON response for a REST API endpoint',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      mockResourceType: 'rest',
      mockStatusCode: 200,
      mockBodyType: 'static',
      mockStaticBody: '{\n  "status": "ok",\n  "data": []\n}',
    },
  },
  {
    key: 'mock-404',
    icon: '❌',
    name: 'Mock 404',
    description: 'Return a 404 Not Found response',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      mockResourceType: 'rest',
      mockStatusCode: 404,
      mockBodyType: 'static',
      mockStaticBody: '{\n  "error": "Not Found"\n}',
    },
  },
  {
    key: 'mock-500',
    icon: '💥',
    name: 'Mock Server Error',
    description: 'Return a 500 Internal Server Error — test error handling',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      mockResourceType: 'rest',
      mockStatusCode: 500,
      mockBodyType: 'static',
      mockStaticBody: '{\n  "error": "Internal Server Error"\n}',
    },
  },
  {
    key: 'mock-graphql',
    icon: '🔮',
    name: 'Mock GraphQL Response',
    description: 'Return a custom response for a specific GraphQL operation',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      mockResourceType: 'graphql',
      mockStatusCode: 200,
      mockBodyType: 'static',
      mockStaticBody:
        '{\n  "data": {\n    "user": {\n      "id": "1",\n      "name": "Test User",\n      "email": "user@openheaders.io"\n    }\n  }\n}',
      mockGraphqlKey: 'operationName',
      mockGraphqlOperator: 'Equals',
      mockGraphqlValue: 'GetUser',
    },
  },
  {
    key: 'mock-dynamic',
    icon: '⚙️',
    name: 'Dynamic REST Response',
    description:
      'Intercept the real REST API response and modify it with JavaScript — inject test data, remove fields, or transform the response shape',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      mockResourceType: 'rest',
      mockStatusCode: 0,
      mockBodyType: 'dynamic',
      mockDynamicBody: `function modifyResponse(args) {
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
  },
  {
    key: 'mock-dynamic-graphql',
    icon: '⚙️',
    name: 'Dynamic GraphQL Response',
    description:
      'Intercept a specific GraphQL operation response and modify it with JavaScript — reshape data, inject mock fields, or simulate errors',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      mockResourceType: 'graphql',
      mockStatusCode: 0,
      mockBodyType: 'dynamic',
      mockGraphqlKey: 'operationName',
      mockGraphqlOperator: 'Equals',
      mockGraphqlValue: 'GetUser',
      mockDynamicBody: `function modifyResponse(args) {
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
  },
];

// ── Lookup by rule type ─────────────────────────────────────────

export const TEMPLATES_BY_TYPE: Record<string, RuleTemplate[]> = {
  header: HEADER_TEMPLATES,
  block: BLOCK_TEMPLATES,
  redirect: REDIRECT_TEMPLATES,
  'query-param': QUERY_PARAM_TEMPLATES,
  inject: INJECT_TEMPLATES,
  delay: DELAY_TEMPLATES,
  body: BODY_TEMPLATES,
  mock: MOCK_TEMPLATES,
};
