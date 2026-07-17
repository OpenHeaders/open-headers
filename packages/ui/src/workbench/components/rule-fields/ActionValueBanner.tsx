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
import type { MessageKey } from '@openheaders/i18n';
import type { HeaderModification, QueryParamRule, Rule, RuleCondition, RuleType } from '@openheaders/core/types';
import {
  type ActionValueIssue,
  type ActionValueIssueKind,
  buildMessageFilter,
  validateActionValues,
} from '@openheaders/core/utils';
import { Form, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { headerValidationMessage } from '@openheaders/ui/shared/headers';

interface ActionValueBannerProps {
  ruleType: RuleType;
}

export const ActionValueBanner: React.FC<ActionValueBannerProps> = ({ ruleType }) => {
  const t = useT();
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
            {dedupeMessages(errors, t).map((line, i) => (
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
            {dedupeMessages(warnings, t).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Kind → catalog key for every action issue whose copy converted. The
 * header-plane kinds (name / value / operation) are absent by design:
 * their issues carry core's structured `code`/`params` and resolve
 * through the shared `headerValidationMessage` mirror instead.
 */
const ACTION_ISSUE_KEY: Partial<Record<ActionValueIssueKind, MessageKey>> = {
  'redirect-url-whitespace': 'workbench.editors.rule.actionIssue.redirectWhitespace',
  'invalid-redirect-url': 'workbench.editors.rule.actionIssue.invalidRedirectUrl',
  'inject-url-scheme': 'workbench.editors.rule.actionIssue.injectUrlScheme',
  'inject-url-invalid': 'workbench.editors.rule.actionIssue.injectUrlInvalid',
  'invalid-status-code': 'workbench.editors.rule.actionIssue.invalidStatusCode',
  'invalid-param-name': 'workbench.editors.rule.actionIssue.invalidParamName',
  'delay-above-navigation-cap': 'workbench.editors.rule.actionIssue.delayAboveNavigationCap',
  'delay-above-fetch-cap': 'workbench.editors.rule.actionIssue.delayAboveFetchCap',
  'invalid-content-type': 'workbench.editors.rule.actionIssue.invalidContentType',
  'invalid-graphql-filter': 'workbench.editors.rule.actionIssue.graphqlKeyRequired',
  'message-filter-value-required': 'workbench.editors.rule.actionIssue.messageFilterValueRequired',
  'message-filter-invalid-regex': 'workbench.editors.rule.actionIssue.messageFilterInvalidRegex',
  'inject-trigger-requires-filter': 'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter',
};

function dedupeMessages(issues: readonly ActionValueIssue[], t: Translate): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const issue of issues) {
    const key = ACTION_ISSUE_KEY[issue.kind];
    const line = key ? t(key) : headerValidationMessage(t, issue);
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
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
    // The form field names are prefixed (`injectCode`, `requestBodyType`,
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
    case 'request-body': {
      const bodyType = (formValues.requestBodyType as 'static' | 'dynamic') ?? 'static';
      const bodyContent =
        bodyType === 'dynamic'
          ? ((formValues.requestDynamicBody as string) ?? '')
          : ((formValues.requestStaticBody as string) ?? '');
      const gqlKey = ((formValues.requestGraphqlKey as string) ?? '').trim();
      return {
        ...baseShell,
        type: 'request-body',
        action: {
          bodyType,
          requestBody: bodyContent,
          resourceType: (formValues.requestResourceType as 'rest' | 'graphql') ?? 'rest',
          graphqlFilter: gqlKey
            ? {
                key: gqlKey,
                operator: ((formValues.requestGraphqlOperator as string) || 'Equals') as 'Equals' | 'Contains',
                value: (formValues.requestGraphqlValue as string) ?? '',
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
          messageFilter: buildMessageFilter(formValues.wsFilterType, formValues.wsFilterValue),
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
          messageFilter: buildMessageFilter(formValues.sseFilterType, formValues.sseFilterValue),
          payload: (formValues.ssePayload as string) ?? '',
          injectTrigger: formValues.sseInjectTrigger as 'open' | 'message' | undefined,
        },
      };
    default:
      return null;
  }
}
