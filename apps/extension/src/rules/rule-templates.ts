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
      headerName: 'Access-Control-Allow-Origin',
      headerOperation: 'override',
      isResponse: true,
      staticValue: '*',
    },
  },
  {
    key: 'custom-ua',
    icon: '🕵️',
    name: 'Custom User-Agent',
    description: 'Override the User-Agent header for specific domains',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      headerName: 'User-Agent',
      headerOperation: 'override',
      isResponse: false,
      staticValue: 'Mozilla/5.0 (compatible; CustomBot/1.0)',
    },
  },
  {
    key: 'api-auth',
    icon: '🔑',
    name: 'API Auth Injection',
    description: 'Auto-inject Authorization header into API calls',
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    formValues: {
      headerName: 'Authorization',
      headerOperation: 'override',
      isResponse: false,
      staticValue: 'Bearer YOUR_TOKEN',
    },
  },
  {
    key: 'remove-csp',
    icon: '⚡',
    name: 'Remove CSP',
    description: 'Strip Content-Security-Policy headers for development',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      headerName: 'Content-Security-Policy',
      headerOperation: 'remove',
      isResponse: true,
      staticValue: '',
    },
  },
  {
    key: 'block-cookies',
    icon: '🍪',
    name: 'Block Cookies',
    description: 'Remove Cookie header from outgoing requests',
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    formValues: {
      headerName: 'Cookie',
      headerOperation: 'remove',
      isResponse: false,
      staticValue: '',
    },
  },
  {
    key: 'allow-embedding',
    icon: '🖼️',
    name: 'Allow Embedding',
    description: 'Remove X-Frame-Options to allow iframing',
    conditions: [{ type: 'resource-types', values: ['page'] }],
    formValues: {
      headerName: 'X-Frame-Options',
      headerOperation: 'remove',
      isResponse: true,
      staticValue: '',
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
    description: 'Redirect HTTP URLs to HTTPS',
    conditions: [{ type: 'url-filter', values: ['http://*/*'] }],
    formValues: { redirectTo: 'https://$1' },
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
        '<style>\n  html { filter: invert(1) hue-rotate(180deg); }\n  img, video { filter: invert(1) hue-rotate(180deg); }\n</style>',
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
        '<script type="text/javascript">\n  const origFetch = window.fetch;\n  window.fetch = function(...args) {\n    console.log("[OH]", args[0]);\n    return origFetch.apply(this, args);\n  };\n</script>',
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
