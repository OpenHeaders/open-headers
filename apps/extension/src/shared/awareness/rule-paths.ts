/**
 * Canonical rule field paths for awareness publishing.
 *
 * Surfaces (workbench, devpanel, popup) publish `fieldFocus.path` strings
 * the awareness mirror compares verbatim. This module is the single
 * source of truth for the path strings so two surfaces that focus the
 * "same" field agree on its name.
 *
 * **Set-row identity is the persisted item uid, not the form list index.**
 * The schema persists a `uid` on every set-modeled row (`HeaderModification`,
 * `RuleCondition`, `QueryParamEntry`); the form binds it through a hidden
 * `Form.Item` so `getFieldsValue` round-trips it. Indexing by uid keeps
 * paths stable across reorders — two surfaces dragging the same row to
 * different positions still resolve to the same `action.requestHeaders.<uid>.value`
 * path. The oracle's set-modeled mutators already use uid as the canonical
 * `itemId`; awareness is now aligned with that single identity.
 *
 * `mockHeader(name, leaf)` is the exception: `MockAction.responseHeaders`
 * is a `Record<string, string>` whose schema key IS the header name, so
 * the name itself is the row identity (renaming = remove + add). No uid
 * needed.
 */

export const RULE_FIELD = {
  // Top-level scalar leaves.
  name: 'name',
  enabled: 'enabled',
  conditions: 'conditions',
  redirectTo: 'action.redirectTo',
  // Inject action leaves.
  injectType: 'action.injectType',
  injectSource: 'action.source',
  injectCode: 'action.code',
  injectSourceUrl: 'action.sourceUrl',
  injectPosition: 'action.position',
  // Body action leaves.
  bodyType: 'action.bodyType',
  body: 'action.body',
  bodyResourceType: 'action.resourceType',
  // GraphQL operation filter — shared field shape between Body + Mock
  // (the `graphqlFilter: { key, operator, value }` sub-object). Same
  // schema path on both rule types so the path strings reuse.
  graphqlKey: 'action.graphqlFilter.key',
  graphqlOperator: 'action.graphqlFilter.operator',
  graphqlValue: 'action.graphqlFilter.value',
  // Delay action leaf.
  delayMs: 'action.delayMs',
  // Mock action scalar leaves.
  mockStatusCode: 'action.statusCode',
  mockResponseBody: 'action.responseBody',
  mockContentType: 'action.contentType',
  mockBodyType: 'action.bodyType',
  /** Header mods. `direction` is `'request'` or `'response'`. */
  headerMod(direction: 'request' | 'response', uid: string, leaf: 'headerName' | 'value' | 'operation' | 'mergeSeparator'): string {
    const set = direction === 'request' ? 'action.requestHeaders' : 'action.responseHeaders';
    return `${set}.${uid}.${leaf}`;
  },
  condition(uid: string, leaf: 'values' | 'field' | 'headerName'): string {
    return `conditions.${uid}.${leaf}`;
  },
  queryParam(uid: string, leaf: 'param' | 'value' | 'operation'): string {
    return `action.params.${uid}.${leaf}`;
  },
  /**
   * Mock response header per row, keyed by header name (the schema's
   * `Record<string, string>` key). Renaming the header = remove + add;
   * the path moves with the name.
   */
  mockHeader(name: string, leaf: 'name' | 'value'): string {
    return `action.responseHeaders.${name}.${leaf}`;
  },
} as const;
