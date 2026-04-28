/**
 * Map antd Form input ids to canonical RULE_FIELD-style path strings
 * (Phase A A2/A3 — workbench per-field awareness publishing).
 *
 * Antd's Form derives DOM ids from `name` paths: a top-level scalar
 * ("redirectTo") gets `id="redirectTo"`; a Form.List entry with name
 * `[ "requestHeaders", 0, "value" ]` gets `id="requestHeaders_0_value"`.
 * Awareness consumers (devpanel popover, popup row chip) expect
 * dotted-path strings produced by `RULE_FIELD` in
 * `apps/extension/src/shared/awareness/rule-paths.ts`. This module
 * is the bridge: from focus-target id to RULE_FIELD path.
 *
 * Returns null for unknown ids so the focus capture handler can ignore
 * non-rule inputs (modal close buttons, dropdowns, etc.) without
 * publishing wrong-path focus signals.
 */

const HEADER_MOD = /^(requestHeaders|responseHeaders)_(\d+)_(value|headerName|operation|mergeSeparator)$/;
const CONDITION = /^conditions_(\d+)_(value|op|field)$/;
const QUERY_PARAM = /^queryParams_(\d+)_(param|value|operation)$/;
const MOCK_HEADER = /^mockResponseHeaders_(\d+)_(name|value)$/;
const SCALAR = /^[a-zA-Z][a-zA-Z0-9]*$/;

export function mapAntdIdToFieldPath(id: string | null | undefined): string | null {
  if (!id) return null;
  let m = HEADER_MOD.exec(id);
  if (m) return `action.${m[1]}.${m[2]}.${m[3]}`;
  m = CONDITION.exec(id);
  if (m) return `conditions.${m[1]}.${m[2]}`;
  m = QUERY_PARAM.exec(id);
  if (m) return `action.params.${m[1]}.${m[2]}`;
  m = MOCK_HEADER.exec(id);
  if (m) return `action.responseHeaders.${m[1]}.${m[2]}`;
  if (SCALAR.test(id)) return id;
  return null;
}
