/**
 * Pure projection: form values → Rule shape.
 *
 * Used at save time (`handleSubmit` reads form values and projects to
 * the mutation payload) AND at dirty-derivation time (the same
 * projection is fingerprinted and compared to `liveRule`). One source
 * of truth, no React hook-order constraints — the function is a
 * module-level pure helper so it can be referenced from anywhere in
 * the editor without TDZ issues.
 *
 * `name` / `enabled` are externally-owned (sourced from `liveRule`
 * and updated via inline-rename / toggle paths, not the form). They
 * flow through here as parameters so the projected shape lines up
 * with what the mirror stores; the dirty fingerprint compares
 * like-for-like.
 */

import type {
  ApiResourceType,
  AuthRule,
  BlockRule,
  DelayRule,
  HeaderModification,
  HeaderRule,
  InjectAction,
  InjectRule,
  InjectSource,
  InjectTrigger,
  InjectType,
  MessageOperation,
  QueryParamOperation,
  QueryParamRule,
  RedirectRule,
  RequestBodyRule,
  RequestBodyType,
  ResponseBodyType,
  ResponseRule,
  ResponseSource,
  Rule,
  RuleCondition,
  SseRule,
  WsDirection,
  WsRule,
} from '@openheaders/core/types';
import { buildMessageFilter, generateUid } from '@openheaders/core/utils';

export function buildRule(
  formValues: Record<string, unknown>,
  ruleName: string,
  isEnabled: boolean,
): Omit<Rule, 'uid' | 'path'> | null {
  const conditions = Array.isArray(formValues.conditions) ? (formValues.conditions as RuleCondition[]) : [];
  const base = { name: ruleName, enabled: isEnabled, conditions };

  switch (formValues.ruleType) {
    case 'header':
      return {
        ...base,
        type: 'header',
        action: {
          requestHeaders: (formValues.requestHeaders as HeaderModification[]) ?? [],
          responseHeaders: (formValues.responseHeaders as HeaderModification[]) ?? [],
        },
      } as Omit<HeaderRule, 'uid' | 'path'>;
    case 'block':
      return { ...base, type: 'block', action: {} } as Omit<BlockRule, 'uid' | 'path'>;
    case 'redirect':
      return {
        ...base,
        type: 'redirect',
        action: { redirectTo: (formValues.redirectTo as string) ?? '' },
      } as Omit<RedirectRule, 'uid' | 'path'>;
    case 'query-param':
      return {
        ...base,
        type: 'query-param',
        action: {
          params: (
            formValues.queryParams as Array<{ uid?: string; param: string; value: string; operation: string }>
          ).map((p) => ({
            // Mint when the row was added by the editor before the
            // hidden uid Form.Item was bound (e.g. seed templates,
            // freshly-cloned rows). Existing rows preserve their
            // persisted uid so awareness paths remain stable across
            // reorders.
            uid: p.uid ?? generateUid(),
            param: p.param,
            value: p.operation === 'remove' ? undefined : p.value,
            operation: p.operation as QueryParamOperation,
          })),
        },
      } as Omit<QueryParamRule, 'uid' | 'path'>;
    case 'inject':
      return {
        ...base,
        type: 'inject',
        action: {
          injectType: formValues.injectType as InjectType,
          source: ((formValues.injectSource as string) || 'code') as InjectSource,
          code: (formValues.injectCode as string) ?? '',
          sourceUrl: (formValues.injectSourceUrl as string) || undefined,
          position: formValues.injectPosition as InjectAction['position'],
          bypassCSP: (formValues.injectBypassCSP as boolean) || false,
        },
      } as Omit<InjectRule, 'uid' | 'path'>;
    case 'delay':
      return {
        ...base,
        type: 'delay',
        action: { delayMs: (formValues.delayMs as number) || 0 },
      } as Omit<DelayRule, 'uid' | 'path'>;
    case 'request-body':
      return {
        ...base,
        type: 'request-body',
        action: {
          bodyType: ((formValues.requestBodyType as string) ?? 'static') as RequestBodyType,
          requestBody:
            formValues.requestBodyType === 'dynamic'
              ? ((formValues.requestDynamicBody as string) ?? '')
              : ((formValues.requestStaticBody as string) ?? ''),
          resourceType: ((formValues.requestResourceType as string) ?? 'rest') as ApiResourceType,
          graphqlFilter:
            formValues.requestResourceType === 'graphql' && (formValues.requestGraphqlKey as string)?.trim()
              ? {
                  key: (formValues.requestGraphqlKey as string).trim(),
                  operator: ((formValues.requestGraphqlOperator as string) || 'Equals') as 'Equals' | 'Contains',
                  value: (formValues.requestGraphqlValue as string) || '',
                }
              : undefined,
        },
      } as Omit<RequestBodyRule, 'uid' | 'path'>;
    case 'response':
      return {
        ...base,
        type: 'response',
        action: {
          responseSource: ((formValues.responseSource as string) ?? 'mock') as ResponseSource,
          statusCode: (formValues.responseStatusCode as number) || 0,
          responseBody:
            formValues.responseBodyType === 'dynamic'
              ? ((formValues.responseDynamicBody as string) ?? '')
              : ((formValues.responseStaticBody as string) ?? ''),
          contentType: (formValues.responseContentType as string) ?? 'application/json',
          // Form.List rows → Record<string, string>. Drops empty
          // names; later occurrences of the same name silently
          // win (matches Object.fromEntries semantics — fine because
          // duplicate response headers are nonsensical).
          responseHeaders: Object.fromEntries(
            ((formValues.responseHeaderRows as Array<{ name?: string; value?: string }>) ?? [])
              .filter((h) => h.name?.trim())
              .map((h) => [h.name!.trim(), h.value ?? '']),
          ),
          bodyType: ((formValues.responseBodyType as string) ?? 'static') as ResponseBodyType,
          resourceType: ((formValues.responseResourceType as string) ?? 'rest') as ApiResourceType,
          graphqlFilter:
            formValues.responseResourceType === 'graphql' && (formValues.responseGraphqlKey as string)?.trim()
              ? {
                  key: (formValues.responseGraphqlKey as string).trim(),
                  operator: ((formValues.responseGraphqlOperator as string) || 'Equals') as 'Equals' | 'Contains',
                  value: (formValues.responseGraphqlValue as string) || '',
                }
              : undefined,
        },
      } as Omit<ResponseRule, 'uid' | 'path'>;
    case 'ws':
      return {
        ...base,
        type: 'ws',
        action: {
          operation: ((formValues.wsOperation as string) ?? 'modify') as MessageOperation,
          direction: ((formValues.wsDirection as string) ?? 'receive') as WsDirection,
          messageFilter: buildMessageFilter(formValues.wsFilterType, formValues.wsFilterValue),
          payload: formValues.wsOperation === 'drop' ? undefined : ((formValues.wsPayload as string) ?? ''),
          injectTrigger:
            formValues.wsOperation === 'inject'
              ? (((formValues.wsInjectTrigger as string) ?? 'open') as InjectTrigger)
              : undefined,
        },
      } as Omit<WsRule, 'uid' | 'path'>;
    case 'sse':
      return {
        ...base,
        type: 'sse',
        action: {
          operation: ((formValues.sseOperation as string) ?? 'modify') as MessageOperation,
          eventName: (formValues.sseEventName as string)?.trim() || undefined,
          messageFilter: buildMessageFilter(formValues.sseFilterType, formValues.sseFilterValue),
          payload: formValues.sseOperation === 'drop' ? undefined : ((formValues.ssePayload as string) ?? ''),
          injectTrigger:
            formValues.sseOperation === 'inject'
              ? (((formValues.sseInjectTrigger as string) ?? 'open') as InjectTrigger)
              : undefined,
        },
      } as Omit<SseRule, 'uid' | 'path'>;
    case 'auth':
      return {
        ...base,
        type: 'auth',
        action: {
          username: (formValues.authUsername as string) ?? '',
          password: (formValues.authPassword as string) ?? '',
        },
      } as Omit<AuthRule, 'uid' | 'path'>;
    default:
      return null;
  }
}
