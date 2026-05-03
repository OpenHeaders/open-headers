/**
 * Human-readable labels for rule field paths.
 *
 * The conflict-tracker addresses fields by canonical schema paths
 * (`action.requestHeaders.<uid>.value`, `action.params.<uid>.param`,
 * etc.) so awareness + LWW key consistently across surfaces. Those
 * paths are correct for code; users want "Request header X-Debug-2
 * → value" instead.
 */

import type { V5 } from '@openheaders/core/types';

const SCALAR_LABEL: Record<string, string> = {
  redirectTo: 'Redirect URL',
  delayMs: 'Delay (ms)',
  injectType: 'Inject type',
  source: 'Inject source',
  code: 'Inject code',
  sourceUrl: 'Inject source URL',
  position: 'Inject position',
  body: 'Body',
  bodyType: 'Body type',
  resourceType: 'Resource type',
  statusCode: 'Mock status code',
  responseBody: 'Mock response body',
  contentType: 'Mock content type',
};

const HEADER_LEAF: Record<string, string> = {
  value: 'value',
  headerName: 'name',
  operation: 'operation',
  mergeSeparator: 'merge separator',
};

const PARAM_LEAF: Record<string, string> = {
  value: 'value',
  param: 'name',
  operation: 'operation',
};

const CONDITION_LEAF: Record<string, string> = {
  values: 'values',
  field: 'field',
  headerName: 'header name',
};

function findHeaderName(
  rule: V5.Rule,
  set: 'requestHeaders' | 'responseHeaders',
  uid: string,
): string | null {
  if (rule.type !== 'header') return null;
  const arr = set === 'requestHeaders' ? rule.action.requestHeaders : rule.action.responseHeaders;
  return arr?.find((h) => h.uid === uid)?.headerName ?? null;
}

function findParamName(rule: V5.Rule, uid: string): string | null {
  if (rule.type !== 'query-param') return null;
  return rule.action.params?.find((p) => p.uid === uid)?.param ?? null;
}

function setPathSummary(setPath: string): string {
  if (setPath === 'action.requestHeaders') return 'Request header';
  if (setPath === 'action.responseHeaders') return 'Response header';
  if (setPath === 'action.params') return 'Query param';
  if (setPath === 'conditions') return 'Condition';
  return setPath;
}

/**
 * Render a path as a short human-readable label. Falls back to the raw
 * path string when the structure isn't recognized (defensive — better to
 * show the path than to swallow the conflict).
 */
export function prettyRulePath(rule: V5.Rule, path: string): string {
  if (path.startsWith('reorder:')) {
    const setPath = path.slice('reorder:'.length);
    const kind = setPathSummary(setPath);
    return `${kind}s — order changed`;
  }
  // Set-level paths surfaced by the conflict tracker as `set:<path>.<uid>`.
  if (path.startsWith('set:')) {
    const m = /^set:(.+)\.([a-z0-9]{8})$/.exec(path);
    if (!m) return path;
    const setPath = m[1];
    const uid = m[2];
    const kind = setPathSummary(setPath);
    // Try to resolve a friendly identifier (header name / param name)
    // from whichever side currently has the row.
    if (setPath === 'action.requestHeaders' || setPath === 'action.responseHeaders') {
      const dir = setPath === 'action.requestHeaders' ? 'requestHeaders' : 'responseHeaders';
      const arr = rule.type === 'header' ? rule.action[dir] : undefined;
      const found = arr?.find((h) => h.uid === uid);
      return found ? `${kind} ${found.headerName}` : kind;
    }
    if (setPath === 'action.params' && rule.type === 'query-param') {
      const found = rule.action.params?.find((p) => p.uid === uid);
      return found ? `${kind} ${found.param}` : kind;
    }
    if (setPath === 'conditions') {
      const found = rule.conditions?.find((c) => c.uid === uid);
      return found ? `${kind} ${found.type}` : kind;
    }
    return kind;
  }

  if (path === 'name') return 'Name';

  if (path.startsWith('conditions.')) {
    const m = /^conditions\.([a-z0-9]{8})\.(values|field|headerName)$/.exec(path);
    if (m) {
      const leaf = CONDITION_LEAF[m[2]] ?? m[2];
      return `Condition ${leaf}`;
    }
    return path;
  }

  if (!path.startsWith('action.')) return path;
  const tail = path.slice('action.'.length);

  const headerMod = /^(requestHeaders|responseHeaders)\.([a-z0-9]{8})\.(value|headerName|operation|mergeSeparator)$/.exec(tail);
  if (headerMod) {
    const set = headerMod[1] as 'requestHeaders' | 'responseHeaders';
    const uid = headerMod[2];
    const leaf = HEADER_LEAF[headerMod[3]] ?? headerMod[3];
    const dir = set === 'requestHeaders' ? 'Request' : 'Response';
    const name = findHeaderName(rule, set, uid);
    return name ? `${dir} header ${name} (${leaf})` : `${dir} header (${leaf})`;
  }

  const queryParam = /^params\.([a-z0-9]{8})\.(param|value|operation)$/.exec(tail);
  if (queryParam) {
    const uid = queryParam[1];
    const leaf = PARAM_LEAF[queryParam[2]] ?? queryParam[2];
    const name = findParamName(rule, uid);
    return name ? `Query param ${name} (${leaf})` : `Query param (${leaf})`;
  }

  const mockHeader = /^responseHeaders\.([^.]+)\.(name|value)$/.exec(tail);
  if (mockHeader) {
    const headerName = mockHeader[1];
    const leaf = mockHeader[2];
    return `Mock response header ${headerName} (${leaf})`;
  }

  if (!tail.includes('.') && SCALAR_LABEL[tail]) return SCALAR_LABEL[tail];

  return path;
}

export function prettyRulePathMap(rule: V5.Rule, paths: Iterable<string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of paths) out.set(p, prettyRulePath(rule, p));
  return out;
}
