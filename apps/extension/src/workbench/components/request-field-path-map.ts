/**
 * Map RequestEditor tab keys + ad-hoc input slots to canonical
 * V5.Request field paths for awareness publishing.
 *
 * RequestEditor doesn't use antd Form (controlled `draft` state instead),
 * so the rule-style "antd id → path" mapping doesn't apply. Awareness
 * surfaces collide on the LOGICAL section being edited (which tab is
 * active, or the URL bar / method picker outside the tabs). The path
 * strings here align with V5.Request schema fields so future
 * cross-surface editors (e.g. a future request inspector) can publish
 * the same paths verbatim.
 */

export type RequestTabKey = 'docs' | 'params' | 'authorization' | 'headers' | 'body' | 'scripts' | 'settings';

const TAB_PATHS: Record<RequestTabKey, string> = {
  docs: 'description',
  params: 'params',
  authorization: 'auth',
  headers: 'headers',
  body: 'body',
  scripts: 'scripts',
  settings: 'settings',
};

export function tabKeyToRequestFieldPath(tab: RequestTabKey): string {
  return TAB_PATHS[tab];
}

export const REQUEST_URL_PATH = 'url';
export const REQUEST_METHOD_PATH = 'method';

/**
 * Per-row path inside the headers / params tables — schema-aligned
 * dotted form (`headers.0.value`, `params.2.key`).
 *
 * Index-based, not uid-based: the V5.Request schema persists each
 * collection as an ordered array, so `headers[0]` is the first element
 * regardless of which surface published the path. UID-based paths
 * would be local to one editor session and would never converge with
 * a future cross-surface inspector. The same posture session 33's
 * `LIVE_WORKFLOW_FIELD.step(idx, leaf)` took for workflow steps.
 */
export type RequestRowSetPath = 'headers' | 'params';
export type RequestRowLeaf = 'key' | 'value' | 'description';
export function requestRowPath(setPath: RequestRowSetPath, index: number, leaf: RequestRowLeaf): string {
  return `${setPath}.${index}.${leaf}`;
}
