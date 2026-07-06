/**
 * Doc-ID maps + lookup helpers consumed by the rule editor's "?"
 * buttons. Pure data — no React, no DOM. Lives outside the panel
 * implementation so callers can import without dragging in the
 * Docs panel module.
 */

const CONDITION_DOC_ID: Record<string, string> = {
  'url-filter': 'url-pattern',
  'url-regex': 'url-regex',
  'request-domains': 'request-domains',
  'exclude-request-domains': 'exclude-domains',
  'initiator-domains': 'initiator-domains',
  'exclude-initiator-domains': 'initiator-domains',
  'request-methods': 'methods',
  'exclude-request-methods': 'methods',
  'resource-types': 'condition-resource-types',
  'exclude-resource-types': 'condition-resource-types',
  'domain-type': 'domain-type',
  'response-header': 'headers',
  'exclude-response-header': 'headers',
};

const ACTION_DOC_ID: Record<string, string> = {
  // Header operations
  override: 'override',
  add: 'append',
  remove: 'remove',
  merge: 'merge',
  // Rule type sections
  block: 'block',
  redirect: 'redirect',
  'query-param': 'query-param',
  inject: 'inject',
  delay: 'delay',
  'request-body': 'request-body',
  response: 'response',
  auth: 'auth',
  // Query param operations
  'qp-add': 'qp-add',
  'qp-override': 'qp-override',
  'qp-remove': 'qp-remove',
  'qp-remove-all': 'qp-remove-all',
  // Inject types
  'inject-script': 'inject-script',
  'inject-css': 'inject-css',
  // Request-body types
  'request-body-static': 'request-body-static',
  'request-body-dynamic': 'request-body-dynamic',
  'request-body-graphql': 'request-body-graphql',
  // Response types
  'response-static': 'response-static',
  'response-dynamic': 'response-dynamic',
  'response-graphql': 'response-graphql',
  // Redirect
  'redirect-url': 'redirect-url',
  'redirect-regex': 'redirect-regex',
};

/** Get the docs anchor ID for a condition type or action operation. */
export function getDocId(type: string, kind: 'condition' | 'action'): string {
  if (kind === 'condition') return CONDITION_DOC_ID[type] ?? 'conditions';
  return ACTION_DOC_ID[type] ?? 'header-actions';
}

/**
 * Map of sub-anchor doc-ids → owning section id. Top-level section
 * ids resolve to themselves (handled by the `?? docId` fallback in
 * `resolveDocLink`), so they don't need to appear here.
 */
export const DOC_ID_TO_SECTION: Record<string, string> = {
  // Conditions sub-anchors
  'url-pattern': 'conditions',
  'url-regex': 'conditions',
  'request-domains': 'conditions',
  'exclude-domains': 'conditions',
  'initiator-domains': 'conditions',
  methods: 'conditions',
  'condition-resource-types': 'conditions',
  'domain-type': 'conditions',
  headers: 'conditions',
  // Header action sub-anchors
  override: 'header-actions',
  append: 'header-actions',
  remove: 'header-actions',
  merge: 'header-actions',
  // Query param sub-anchors
  'qp-add': 'query-param',
  'qp-override': 'query-param',
  'qp-remove': 'query-param',
  'qp-remove-all': 'query-param',
  // Inject sub-anchors
  'inject-script': 'inject',
  'inject-css': 'inject',
  // Request-body sub-anchors
  'request-body-static': 'request-body',
  'request-body-dynamic': 'request-body',
  'request-body-graphql': 'request-body',
  // Response sub-anchors
  'response-static': 'response',
  'response-dynamic': 'response',
  'response-graphql': 'response',
  // Redirect sub-anchors
  'redirect-url': 'redirect',
  'redirect-regex': 'redirect',
  // Variables sub-anchors
  'variables-scopes': 'variables',
  'variables-vault': 'variables',
  'variables-environment': 'variables',
  'variables-collection': 'variables',
  'variables-workspace': 'variables',
  'variables-live': 'variables',
  'variables-priority': 'variables',
  'variables-rules': 'variables',
  'variables-requests': 'variables',
  'variables-workflows': 'variables',
  'variables-namespaces': 'variables',
  'variables-inspecting': 'variables',
};

export function resolveDocLink(docId: string): { section: string; anchor: string | null } {
  const section = DOC_ID_TO_SECTION[docId] ?? docId;
  return { section, anchor: section === docId ? null : docId };
}
