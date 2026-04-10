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
    key: 'graphql-override',
    icon: '📝',
    name: 'GraphQL Override',
    description: 'Override a GraphQL request body',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      bodyResourceType: 'graphql',
      bodyModType: 'static',
      bodyStaticContent: '{"query": "{ viewer { name email } }"}',
    },
  },
];

// ── Mock / API Response templates ───────────────────────────────

export const MOCK_TEMPLATES: RuleTemplate[] = [
  {
    key: 'mock-200',
    icon: '✅',
    name: 'Mock 200 JSON',
    description: 'Return a successful JSON response',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
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
      mockStatusCode: 500,
      mockBodyType: 'static',
      mockStaticBody: '{\n  "error": "Internal Server Error"\n}',
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
