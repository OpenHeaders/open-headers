/**
 * Map antd Form input ids to canonical template field paths
 * (Phase B awareness publishing — same shape as rule-fields/field-path-map.ts).
 *
 * Templates reuse the per-type rule field components, so the antd form
 * derives the same DOM ids (`requestHeaders_0_value`, `redirectTo`, etc.)
 * RuleEditor sees. The schema differs: rule action data lives under
 * `action.*` while template action data lives under `formValues.*`,
 * with a few top-level renames (`templateName` → `name`, etc.).
 *
 * Returns null for unknown ids so the focus capture handler ignores
 * non-template inputs without publishing wrong-path focus signals.
 */

const HEADER_MOD = /^(requestHeaders|responseHeaders)_(\d+)_(value|headerName|operation|mergeSeparator)$/;
const CONDITION = /^conditions_(\d+)_(value|op|field)$/;
const QUERY_PARAM = /^queryParams_(\d+)_(param|value|operation)$/;
const MOCK_HEADER = /^mockResponseHeaders_(\d+)_(name|value)$/;
const SCALAR = /^[a-zA-Z][a-zA-Z0-9]*$/;

const META_RENAMES: Record<string, string> = {
  templateName: 'name',
  templateIcon: 'icon',
  templateDescription: 'description',
  includeConditions: 'includes.conditions',
  includeFormValues: 'includes.formValues',
  ruleType: 'ruleType',
};

export function mapAntdIdToTemplateFieldPath(id: string | null | undefined): string | null {
  if (!id) return null;
  let m = HEADER_MOD.exec(id);
  if (m) return `formValues.${m[1]}.${m[2]}.${m[3]}`;
  m = CONDITION.exec(id);
  if (m) return `conditions.${m[1]}.${m[2]}`;
  m = QUERY_PARAM.exec(id);
  if (m) return `formValues.queryParams.${m[1]}.${m[2]}`;
  m = MOCK_HEADER.exec(id);
  if (m) return `formValues.responseHeaders.${m[1]}.${m[2]}`;
  if (!SCALAR.test(id)) return null;
  if (id in META_RENAMES) return META_RENAMES[id];
  return `formValues.${id}`;
}
