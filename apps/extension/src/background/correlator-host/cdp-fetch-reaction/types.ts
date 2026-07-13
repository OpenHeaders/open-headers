/**
 * Reaction + eval-plan vocabulary — the answers the interceptor gives a
 * paused request/reply/auth-challenge, and the plans it executes for
 * dynamic-body rules.
 */

import type { CdpContinueRequest, CdpFulfillResponse } from '@openheaders/oracle/correlator-cdp';

/**
 * A dynamic `mock`-source `response` match (D2b-2a): the user code plus the
 * static reply envelope. The body is user JS, so the pure reaction can't build
 * the fulfill here — it yields this plan and the interceptor evals
 * `buildResponse` in the request frame's isolated world, then fulfills the
 * returned body under this envelope. No network is touched (mock).
 */
export interface CdpResponseEvalPlan {
  readonly userCode: string;
  readonly statusCode: number;
  readonly contentType: string;
  readonly responseHeaders: Readonly<Record<string, string>>;
}

/**
 * A `network`+dynamic `response` match (D2b-2b): the user code plus the
 * override envelope, carried from the Response stage where the real reply
 * exists. Structurally like {@link CdpResponseEvalPlan} but the envelope
 * semantics are the `network` ones — `statusCode === 0` keeps the real status,
 * `contentType === ''` keeps the real Content-Type (mock bakes in 200 / JSON).
 * The interceptor reads the real body (`getResponseBody`), evals `modifyResponse`
 * over it in the request frame, then fulfills the result under this envelope
 * merged onto the real headers.
 */
export interface CdpNetworkEvalPlan {
  readonly userCode: string;
  readonly statusCode: number;
  readonly contentType: string;
  readonly responseHeaders: Readonly<Record<string, string>>;
}

/**
 * A dynamic `request-body` match (D2b-2c): just the user code. The
 * request-body cell has no status/CT/header envelope (it rewrites the OUTGOING
 * body, not the reply), so unlike {@link CdpResponseEvalPlan} the plan carries
 * nothing else. The interceptor reads the outgoing body (inline `postData` or
 * `getRequestPostData`), evals `modifyRequestBody` over it in the request
 * frame, then `continueRequest`s the transformed body — the real request goes
 * out rewritten, exactly as the static `request-body` cell continues, only the
 * body comes from the eval rather than a literal.
 */
export interface CdpRequestBodyEvalPlan {
  readonly userCode: string;
}

/**
 * The answer the interceptor gives a paused request at the REQUEST stage.
 * Every rule-carrying variant also carries `pattern` — the rule's first URL
 * pattern matching the paused URL, resolved at reaction time — so the fire
 * record annotates like a DNR/injection fire.
 */
export type CdpFetchReaction =
  | {
      readonly kind: 'fulfill';
      readonly ruleUid: string;
      readonly pattern: string;
      readonly response: CdpFulfillResponse;
    }
  | {
      readonly kind: 'continue';
      readonly ruleUid: string;
      readonly pattern: string;
      readonly request: CdpContinueRequest;
    }
  // Send the real request and intercept its reply: a `continueRequest` with
  // `interceptResponse:true`. The fire is DEFERRED to the Response stage —
  // the action only takes effect once the reply is fulfilled there.
  | {
      readonly kind: 'await-response';
      readonly ruleUid: string;
      readonly pattern: string;
      readonly request: CdpContinueRequest;
    }
  // A dynamic `mock`-source body: the interceptor evals the user fn, then
  // fulfills. The fire is DEFERRED to that fulfill — an eval fault releases the
  // request and never fires (fire = the modification actually ran).
  | {
      readonly kind: 'eval-fulfill';
      readonly ruleUid: string;
      readonly pattern: string;
      readonly plan: CdpResponseEvalPlan;
    }
  // A dynamic `request-body`: the interceptor reads the outgoing body, evals
  // `modifyRequestBody` over it, then continues with the rewritten body. The
  // fire is DEFERRED to that continue — an eval / body-read fault (or a
  // bodyless request) releases it with its original body and never fires.
  | {
      readonly kind: 'eval-continue';
      readonly ruleUid: string;
      readonly pattern: string;
      readonly plan: CdpRequestBodyEvalPlan;
    }
  | { readonly kind: 'pass-through' };

/** The answer the interceptor gives a paused request at the RESPONSE stage. */
export type CdpResponseReaction =
  | {
      readonly kind: 'fulfill';
      readonly ruleUid: string;
      readonly pattern: string;
      readonly response: CdpFulfillResponse;
    }
  // A `network`+dynamic body: the interceptor reads the real reply, evals
  // `modifyResponse` over it, then fulfills. The fire is DEFERRED to that
  // fulfill — an eval / body-read fault releases the real reply and never fires.
  | {
      readonly kind: 'eval-response-fulfill';
      readonly ruleUid: string;
      readonly pattern: string;
      readonly plan: CdpNetworkEvalPlan;
    }
  | { readonly kind: 'pass-through' };

/**
 * The answer the interceptor gives a paused AUTH challenge (D3).
 * `provide` carries the resolved credentials + the rule uid (for the fire);
 * `default` lets the browser run its native auth flow when no rule owns the
 * challenge — we never `CancelAuth` a challenge we didn't match.
 */
export type CdpAuthReaction =
  | {
      readonly kind: 'provide';
      readonly ruleUid: string;
      readonly pattern: string;
      readonly username: string;
      readonly password: string;
    }
  | { readonly kind: 'default' };
