/**
 * ActionValueBanner — inline feedback for invalid `action.*` fields.
 *
 * Mirrors the conditions-side `ValueIssueBanner` exactly: errors render
 * in the danger palette (Chrome will reject the rule), warnings in the
 * yellow palette (rule loads but probably doesn't do what the user
 * intended). Both can render together so warnings aren't masked when
 * an error is also present.
 *
 * The validator lives in `@openheaders/core/utils/action-validation`.
 * This component is the single mount point — RuleEditor renders it once
 * per rule type, and it picks up new validators automatically as core
 * adds them.
 *
 * Field watching is done via `Form.useWatch` so the banner re-renders
 * on every keystroke. We assemble a minimal `Rule`-shaped object from
 * the form values and the rule type, then hand it off to the validator
 * — that keeps the watcher stable and avoids per-field subscriptions.
 */

import { WarningFilled } from '@ant-design/icons';
import type { HeaderModification, QueryParamRule, Rule, RuleCondition, RuleType } from '@openheaders/core/types';
import { type ActionValueIssue, validateActionValues } from '@openheaders/core/utils';
import { Form, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';

interface ActionValueBannerProps {
  ruleType: RuleType;
}

export const ActionValueBanner: React.FC<ActionValueBannerProps> = ({ ruleType }) => {
  const { token } = theme.useToken();
  // Subscribe to the entire form — validators are cheap (synchronous,
  // no allocations beyond the issue array) and per-field subscriptions
  // would be 20+ separate hooks scattered across rule types.
  const formValues = Form.useWatch([], { preserve: true });
  const conditions = Form.useWatch('conditions') as RuleCondition[] | undefined;

  const issues = useMemo(() => {
    if (!formValues) return [] as ActionValueIssue[];
    const synthetic = assembleSyntheticRule(ruleType, formValues, conditions ?? []);
    if (!synthetic) return [];
    return validateActionValues(synthetic);
  }, [formValues, conditions, ruleType]);

  if (issues.length === 0) return null;
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
      {errors.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 8px',
            background: token.colorErrorBg,
            border: `1px solid ${token.colorErrorBorder}`,
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.4,
            color: token.colorErrorText,
          }}
        >
          <WarningFilled style={{ color: token.colorError, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {dedupeMessages(errors).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 8px',
            background: token.colorWarningBg,
            border: `1px solid ${token.colorWarningBorder}`,
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.4,
            color: token.colorWarningText,
          }}
        >
          <WarningFilled style={{ color: token.colorWarning, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {dedupeMessages(warnings).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function dedupeMessages(issues: readonly ActionValueIssue[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const issue of issues) {
    if (seen.has(issue.message)) continue;
    seen.add(issue.message);
    out.push(issue.message);
  }
  return out;
}

/**
 * Build a minimal Rule shape from form state for the validator.
 *
 * The form mirrors the eventual `Rule.action` shape one-to-one for
 * each type, so we only need a thin assembly layer. We synthesize the
 * stable `RuleBase` fields (uid, path, etc.) — the validator never
 * reads them, but the type narrows on `rule.type`.
 *
 * Returns `null` if the form is in a state that can't form a rule
 * (no type yet, missing required action wrapper). The banner renders
 * nothing in that case.
 */
function assembleSyntheticRule(
  ruleType: RuleType,
  formValues: Record<string, unknown>,
  conditions: RuleCondition[],
): Rule | null {
  const baseShell = {
    schemaVersion: 1,
    uid: '__synthetic__',
    path: '__synthetic__',
    name: '',
    enabled: true,
    conditions,
    version: 1,
  } as const;

  switch (ruleType) {
    case 'header':
      return {
        ...baseShell,
        type: 'header',
        action: {
          requestHeaders: (formValues.requestHeaders as HeaderModification[]) ?? [],
          responseHeaders: (formValues.responseHeaders as HeaderModification[]) ?? [],
        },
      };
    case 'redirect':
      return {
        ...baseShell,
        type: 'redirect',
        action: { redirectTo: (formValues.redirectTo as string) ?? '' },
      };
    case 'block':
      return { ...baseShell, type: 'block', action: {} };
    case 'delay':
      return {
        ...baseShell,
        type: 'delay',
        action: { delayMs: (formValues.delayMs as number) ?? 0 },
      };
    // The form field names are prefixed (`injectCode`, `bodyModType`,
    // `responseHeaderRows`, …) to keep them unambiguous in the shared
    // form-state object. Map them back to the schema's action shape here.
    case 'inject':
      return {
        ...baseShell,
        type: 'inject',
        action: {
          injectType: (formValues.injectType as 'script' | 'css') ?? 'script',
          source: (formValues.injectSource as 'code' | 'url') ?? 'code',
          code: (formValues.injectCode as string) ?? '',
          sourceUrl: formValues.injectSourceUrl as string | undefined,
          position: (formValues.injectPosition as 'head' | 'body-end') ?? 'head',
          bypassCSP: formValues.injectBypassCSP as boolean | undefined,
        },
      };
    case 'body': {
      const bodyType = (formValues.bodyModType as 'static' | 'dynamic') ?? 'static';
      const bodyContent =
        bodyType === 'dynamic'
          ? ((formValues.bodyDynamicContent as string) ?? '')
          : ((formValues.bodyStaticContent as string) ?? '');
      const gqlKey = ((formValues.bodyGraphqlKey as string) ?? '').trim();
      return {
        ...baseShell,
        type: 'body',
        action: {
          bodyType,
          body: bodyContent,
          resourceType: (formValues.bodyResourceType as 'rest' | 'graphql') ?? 'rest',
          graphqlFilter: gqlKey
            ? {
                key: gqlKey,
                operator: ((formValues.bodyGraphqlOperator as string) || 'Equals') as 'Equals' | 'Contains',
                value: (formValues.bodyGraphqlValue as string) ?? '',
              }
            : undefined,
        },
      };
    }
    case 'response': {
      const bodyType = (formValues.responseBodyType as 'static' | 'dynamic') ?? 'static';
      const responseBody =
        bodyType === 'dynamic'
          ? ((formValues.responseDynamicBody as string) ?? '')
          : ((formValues.responseStaticBody as string) ?? '');
      // Form.List rows → Record<string, string>. Mirrors the save-path
      // conversion in RuleEditor so the validator sees the shape Chrome
      // would actually receive.
      const responseHeaders = Object.fromEntries(
        ((formValues.responseHeaderRows as Array<{ name?: string; value?: string }>) ?? [])
          .filter((h) => h.name?.trim())
          .map((h) => [h.name!.trim(), h.value ?? '']),
      );
      const gqlKey = ((formValues.responseGraphqlKey as string) ?? '').trim();
      return {
        ...baseShell,
        type: 'response',
        action: {
          responseSource: ((formValues.responseSource as string) ?? 'mock') as 'mock' | 'network',
          statusCode: (formValues.responseStatusCode as number) ?? 200,
          responseHeaders,
          responseBody,
          contentType: (formValues.responseContentType as string) ?? 'application/json',
          bodyType,
          resourceType: formValues.responseResourceType as 'rest' | 'graphql' | undefined,
          graphqlFilter: gqlKey
            ? {
                key: gqlKey,
                operator: ((formValues.responseGraphqlOperator as string) || 'Equals') as 'Equals' | 'Contains',
                value: (formValues.responseGraphqlValue as string) ?? '',
              }
            : undefined,
        },
      };
    }
    case 'query-param':
      // Form field is `queryParams`; the schema field is `params`.
      return {
        ...baseShell,
        type: 'query-param',
        action: { params: (formValues.queryParams as QueryParamRule['action']['params']) ?? [] },
      };
    case 'ws':
      return {
        ...baseShell,
        type: 'ws',
        action: {
          operation: ((formValues.wsOperation as string) ?? 'modify') as 'modify' | 'inject' | 'drop',
          direction: ((formValues.wsDirection as string) ?? 'receive') as 'send' | 'receive',
          messageFilter: syntheticMessageFilter(formValues.wsFilterType, formValues.wsFilterValue),
          payload: (formValues.wsPayload as string) ?? '',
          injectTrigger: formValues.wsInjectTrigger as 'open' | 'message' | undefined,
        },
      };
    case 'sse':
      return {
        ...baseShell,
        type: 'sse',
        action: {
          operation: ((formValues.sseOperation as string) ?? 'modify') as 'modify' | 'inject' | 'drop',
          eventName: (formValues.sseEventName as string)?.trim() || undefined,
          messageFilter: syntheticMessageFilter(formValues.sseFilterType, formValues.sseFilterValue),
          payload: (formValues.ssePayload as string) ?? '',
          injectTrigger: formValues.sseInjectTrigger as 'open' | 'message' | undefined,
        },
      };
    default:
      return null;
  }
}

/**
 * Mirrors RuleEditor's save-path filter assembly, EXCEPT an empty value
 * with a configured filter type stays as a filter — the validator's
 * "filter value required" error must surface while the user is mid-edit.
 */
function syntheticMessageFilter(
  filterType: unknown,
  filterValue: unknown,
): { matchType: 'contains' | 'regex'; value: string } | undefined {
  if (filterType !== 'contains' && filterType !== 'regex') return undefined;
  return { matchType: filterType, value: (filterValue as string) ?? '' };
}
