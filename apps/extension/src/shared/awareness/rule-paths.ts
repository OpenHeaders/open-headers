/**
 * Action-path bundle — the per-entity field-path generators consumed by
 * the per-type rule-fields/* components for awareness publishing +
 * conflict-tracker keying.
 *
 * Two entities reuse the same per-type field components:
 *   - Rule         — action data lives under `action.*`; query params
 *                    live under `action.params.*`.
 *   - Template     — action data lives under `formValues.*`; query
 *                    params live under `formValues.queryParams.*`.
 *
 * Paths are otherwise identical (same set-row uid keying, same scalar
 * leaves, same condition shape at the entity root). Parameterizing the
 * two roots keeps a single set of rule-fields/* components reusable
 * across both editors instead of duplicating per-entity field code.
 *
 * Set-row identity is the persisted item uid, never the form list
 * index — see `HeaderModificationSchema`, `RuleConditionSchema`,
 * `QueryParamEntrySchema`. The bundle's set-row generators (`headerMod`,
 * `condition`, `queryParam`) consume that uid; reorders preserve paths.
 *
 * `mockHeader(name, leaf)` is the exception: `MockAction.responseHeaders`
 * is a `Record<string, string>` whose schema key IS the header name, so
 * the name itself is the row identity (renaming = remove + add). No
 * uid needed.
 */

export interface ActionPathBundle {
  // Entity-root scalars (identical between rule + template).
  name: string;
  enabled: string;
  conditions: string;
  // Action-tree scalar leaves (rooted at `action.*` or `formValues.*`).
  redirectTo: string;
  injectType: string;
  injectSource: string;
  injectCode: string;
  injectSourceUrl: string;
  injectPosition: string;
  bodyType: string;
  body: string;
  bodyResourceType: string;
  graphqlKey: string;
  graphqlOperator: string;
  graphqlValue: string;
  delayMs: string;
  mockStatusCode: string;
  mockResponseBody: string;
  mockContentType: string;
  mockBodyType: string;
  // Set-tree generators.
  headerMod(
    direction: 'request' | 'response',
    uid: string,
    leaf: 'headerName' | 'value' | 'operation' | 'mergeSeparator',
  ): string;
  condition(uid: string, leaf: 'values' | 'field' | 'headerName'): string;
  queryParam(uid: string, leaf: 'param' | 'value' | 'operation'): string;
  mockHeader(name: string, leaf: 'name' | 'value'): string;
  // Set roots (used for path-prefix presence + set-level conflict keys).
  headerSet(direction: 'request' | 'response'): string;
  queryParamSet: string;
  mockResponseHeaderSet: string;
}

export interface ActionPathsOptions {
  /** Top-level schema key under which action data lives. `'action'` for
   *  Rule, `'formValues'` for Template. */
  actionRoot: string;
  /** Schema key for query params under the action root. `'params'` for
   *  Rule (matches `action.params` in `V5.QueryParamRule`); `'queryParams'`
   *  for Template (matches `formValues.queryParams` per template encoding). */
  queryParamKey: string;
}

export function createActionPaths(opts: ActionPathsOptions): ActionPathBundle {
  const a = opts.actionRoot;
  const qp = opts.queryParamKey;
  const headerSet = (direction: 'request' | 'response'): string =>
    direction === 'request' ? `${a}.requestHeaders` : `${a}.responseHeaders`;
  return {
    name: 'name',
    enabled: 'enabled',
    conditions: 'conditions',
    redirectTo: `${a}.redirectTo`,
    injectType: `${a}.injectType`,
    injectSource: `${a}.source`,
    injectCode: `${a}.code`,
    injectSourceUrl: `${a}.sourceUrl`,
    injectPosition: `${a}.position`,
    bodyType: `${a}.bodyType`,
    body: `${a}.body`,
    bodyResourceType: `${a}.resourceType`,
    graphqlKey: `${a}.graphqlFilter.key`,
    graphqlOperator: `${a}.graphqlFilter.operator`,
    graphqlValue: `${a}.graphqlFilter.value`,
    delayMs: `${a}.delayMs`,
    mockStatusCode: `${a}.statusCode`,
    mockResponseBody: `${a}.responseBody`,
    mockContentType: `${a}.contentType`,
    mockBodyType: `${a}.bodyType`,
    headerMod: (direction, uid, leaf) => `${headerSet(direction)}.${uid}.${leaf}`,
    condition: (uid, leaf) => `conditions.${uid}.${leaf}`,
    queryParam: (uid, leaf) => `${a}.${qp}.${uid}.${leaf}`,
    mockHeader: (name, leaf) => `${a}.responseHeaders.${name}.${leaf}`,
    headerSet,
    queryParamSet: `${a}.${qp}`,
    mockResponseHeaderSet: `${a}.responseHeaders`,
  };
}

export const RULE_ACTION_PATHS: ActionPathBundle = createActionPaths({
  actionRoot: 'action',
  queryParamKey: 'params',
});

export const TEMPLATE_ACTION_PATHS: ActionPathBundle = createActionPaths({
  actionRoot: 'formValues',
  queryParamKey: 'queryParams',
});

/**
 * Back-compat alias for direct rule consumers (RuleHoverPopover,
 * useRuleConflicts) that operate on rules exclusively. New entity-aware
 * code paths read the bundle from context via `useActionPaths()`.
 */
export const RULE_FIELD: ActionPathBundle = RULE_ACTION_PATHS;
