/**
 * Reaction resolvers — the three entry points that answer a paused
 * request (REQUEST stage), an intercepted reply (RESPONSE stage), or an
 * auth challenge with the first realizable matching rule's reaction.
 */

import type { Rule } from '@openheaders/core/types';
import { isFetchRealizableNow } from '@openheaders/core/utils';
import type { CdpAuthRequired, CdpRequestPaused } from '@openheaders/oracle/correlator-cdp';
import {
  buildFulfill,
  buildNetworkEvalPlan,
  buildNetworkFulfill,
  buildRequestBodyEvalPlan,
  buildRequestBodyRewrite,
  buildResponseEvalPlan,
} from './fulfill';
import {
  graphqlGate,
  matchedPatternFor,
  type RequestStageContext,
  requestStageMatches,
  responseStageMatches,
} from './match';
import { cdpResourceTypeToCondition } from './resource-types';
import type { CdpAuthReaction, CdpFetchReaction, CdpResponseReaction } from './types';

/** The first realizable debug-tier rule's request-stage answer, or pass-through. */
export function resolveFetchReaction(event: CdpRequestPaused, rules: readonly Rule[]): CdpFetchReaction {
  const ctx: RequestStageContext = {
    url: event.request.url,
    method: event.request.method,
    resourceType: cdpResourceTypeToCondition(event.resourceType),
  };
  const postData = event.request.postData;

  for (const rule of rules) {
    // Narrow to the Fetch-capable union for `rule.action` below; the
    // debug-tier + static gate is the shared core predicate (it admits both
    // response sources when static, rejecting only dynamic bodies).
    if (rule.type !== 'response' && rule.type !== 'request-body') continue;
    if (!isFetchRealizableNow(rule)) continue;
    if (!graphqlGate(rule.action, postData)) continue;

    if (rule.type === 'response' && rule.action.responseSource === 'network') {
      // Send the real request and intercept the reply; the body substitution
      // + override merge happen at the Response stage, where the response-header
      // conditions (deferred here) become evaluable.
      if (!requestStageMatches(rule, ctx, true)) continue;
      return {
        kind: 'await-response',
        ruleUid: rule.uid,
        pattern: matchedPatternFor(rule, ctx.url),
        request: { requestId: event.requestId, interceptResponse: true },
      };
    }

    if (!requestStageMatches(rule, ctx)) continue;
    if (rule.type === 'response') {
      // A `mock`+dynamic body is user JS — defer to the interceptor's eval.
      // (network+dynamic resolves at the Response stage above.)
      if (rule.action.bodyType === 'dynamic') {
        return {
          kind: 'eval-fulfill',
          ruleUid: rule.uid,
          pattern: matchedPatternFor(rule, ctx.url),
          plan: buildResponseEvalPlan(rule.action),
        };
      }
      return {
        kind: 'fulfill',
        ruleUid: rule.uid,
        pattern: matchedPatternFor(rule, ctx.url),
        response: buildFulfill(event.requestId, rule.action),
      };
    }
    // A dynamic `request-body` is `modifyRequestBody` user JS over the outgoing
    // body — defer to the interceptor's body-read + eval (D2b-2c). A static body
    // substitutes its literal here.
    if (rule.action.bodyType === 'dynamic') {
      return {
        kind: 'eval-continue',
        ruleUid: rule.uid,
        pattern: matchedPatternFor(rule, ctx.url),
        plan: buildRequestBodyEvalPlan(rule.action),
      };
    }
    return {
      kind: 'continue',
      ruleUid: rule.uid,
      pattern: matchedPatternFor(rule, ctx.url),
      request: buildRequestBodyRewrite(event.requestId, rule.action),
    };
  }
  return { kind: 'pass-through' };
}

/**
 * The Response-stage answer for an intercepted reply (reached only via an
 * {@link CdpFetchReaction} `await-response`). Re-matches the live rules — now
 * able to evaluate response-header conditions against the real reply — and
 * fulfills the first matching `network`-source static `response` with its
 * literal body, the real status (or override), and the merged headers. A
 * failed real request, or no longer matching rule, releases the reply
 * untouched (pass-through → `continueResponse`).
 *
 * First-match limitation (intentional): only `network`-source rules are
 * re-evaluated here. When the request-stage winner was a `network`-source rule
 * whose deferred response-header condition fails against the real reply, a
 * `mock` rule ordered after it does NOT become the fallback — the real request
 * was already sent at the request stage, so a later mock short-circuit is
 * structurally precluded by the await-response model. Preferring the mock up
 * front would need response look-ahead before committing the real request;
 * the reply is released unmodified instead.
 */
export function resolveResponseReaction(event: CdpRequestPaused, rules: readonly Rule[]): CdpResponseReaction {
  // A network-layer failure has no reply to fulfill from — let it surface.
  if (event.responseErrorReason !== undefined) return { kind: 'pass-through' };
  const ctx: RequestStageContext = {
    url: event.request.url,
    method: event.request.method,
    resourceType: cdpResourceTypeToCondition(event.resourceType),
  };
  const postData = event.request.postData;
  const responseHeaders = event.responseHeaders ?? [];

  for (const rule of rules) {
    if (rule.type !== 'response') continue;
    if (rule.action.responseSource !== 'network') continue;
    if (!isFetchRealizableNow(rule)) continue;
    if (!graphqlGate(rule.action, postData)) continue;
    if (!responseStageMatches(rule, ctx, responseHeaders)) continue;
    // A `network`+dynamic body is `modifyResponse` user JS over the real reply
    // — defer to the interceptor's body-read + eval (D2b-2b).
    if (rule.action.bodyType === 'dynamic') {
      return {
        kind: 'eval-response-fulfill',
        ruleUid: rule.uid,
        pattern: matchedPatternFor(rule, ctx.url),
        plan: buildNetworkEvalPlan(rule.action),
      };
    }
    return {
      kind: 'fulfill',
      ruleUid: rule.uid,
      pattern: matchedPatternFor(rule, ctx.url),
      response: buildNetworkFulfill(event, rule.action),
    };
  }
  return { kind: 'pass-through' };
}

/**
 * The first in-scope auth rule whose conditions match the challenged
 * request supplies credentials; with no match we answer `default` so the
 * browser runs its native dialog / proxy flow. Pure, like
 * {@link resolveFetchReaction} — it reuses the same request-stage matcher,
 * so an auth rule carrying a condition the auth stage can't evaluate
 * (initiator-domains, etc.) falls through to `default` rather than
 * over-applying. Credentials are already `{{…}}`-resolved upstream
 * (`liveRules`), so they are passed verbatim and never logged.
 */
export function resolveAuthReaction(event: CdpAuthRequired, rules: readonly Rule[]): CdpAuthReaction {
  const ctx: RequestStageContext = {
    url: event.request.url,
    method: event.request.method,
    resourceType: cdpResourceTypeToCondition(event.resourceType),
  };
  for (const rule of rules) {
    if (rule.type !== 'auth') continue;
    if (!isFetchRealizableNow(rule)) continue;
    if (!requestStageMatches(rule, ctx)) continue;
    return {
      kind: 'provide',
      ruleUid: rule.uid,
      pattern: matchedPatternFor(rule, ctx.url),
      username: rule.action.username,
      password: rule.action.password,
    };
  }
  return { kind: 'default' };
}
